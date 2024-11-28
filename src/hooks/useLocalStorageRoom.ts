import { useCallback, useEffect, useState, useMemo } from 'react';
import { createTLStore, TLAsset, TLAssetStore } from 'tldraw';
import { useSync } from '@tldraw/sync';
import { customSchema } from '../../worker/TldrawDurableObject';
import { WORKER_URL } from '../components/Board';
import { SerializedStore } from '@tldraw/store';
import { TLRecord } from '@tldraw/tlschema';
import { TLStoreSchemaOptions } from '@tldraw/editor';
import { Store } from '@tldraw/store'

const MAX_STORAGE_RETRY_ATTEMPTS = 3;
const STORAGE_CLEANUP_THRESHOLD = 0.9; // 90% of quota

export function useLocalStorageRoom(roomId: string) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const store = useMemo(() => {
        const newStore = createTLStore({
            schema: customSchema,
            initialData: localStorage.getItem(`tldraw-store-${roomId}`) as unknown as SerializedStore<TLRecord> | undefined,
        });

        // Set up WebSocket connection with retry logic
        const setupWebSocket = () => {
            const wsUrl = process.env.NODE_ENV === 'development'
                ? `ws://${window.location.hostname}:5172`
                : WORKER_URL.replace(/^https?/, 'wss');

            console.log('Attempting WebSocket connection to:', wsUrl);
            const ws = new WebSocket(`${wsUrl}/connect/${roomId}`);

            let pingInterval: any;

            ws.onopen = () => {
                console.log('WebSocket connected');
                ws.send(JSON.stringify({ type: 'pong' }));
                pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                }, 5000);
            };

            ws.onmessage = (message) => {
                console.log('WebSocket message received:', message.data);
                try {
                    const data = JSON.parse(message.data);
                    console.log('Parsed WebSocket data:', data);
                    if (data.type === 'initial-state') {
                        console.log('Initial state documents:', data.data.documents);
                        const documents = Array.isArray(data.data.documents)
                            ? data.data.documents
                            : Object.values(data.data.documents);

                        store.mergeRemoteChanges(() => {
                            documents.forEach((record: any) => {
                                const actualRecord = record.state ? record.state : record;

                                if (actualRecord.typeName === 'document') {
                                    store.put([{
                                        ...actualRecord,
                                        typeName: 'document'
                                    } as TLRecord]);
                                } else if (actualRecord.typeName === 'page') {
                                    store.put([{
                                        ...actualRecord,
                                        typeName: 'page'
                                    } as TLRecord]);
                                } else {
                                    const normalizedRecord = {
                                        ...actualRecord,
                                        id: actualRecord.id.startsWith('shape:') ? actualRecord.id : `shape:${actualRecord.id}`,
                                        type: actualRecord.type || 'draw',
                                        typeName: 'shape',
                                        x: actualRecord.x || 0,
                                        y: actualRecord.y || 0,
                                        rotation: actualRecord.rotation || 0,
                                        isLocked: actualRecord.isLocked || false,
                                        opacity: actualRecord.opacity || 1,
                                        props: actualRecord.props || {}
                                    } as TLRecord;
                                    store.put([normalizedRecord]);
                                }
                            });
                        });
                    }
                } catch (e) {
                    console.error('Error processing WebSocket message:', e);
                }
            };

            ws.onerror = (error) => {
                console.warn('WebSocket error:', error);
                clearInterval(pingInterval);
                setTimeout(setupWebSocket, 3000);
            };

            ws.onclose = () => {
                console.warn('WebSocket closed');
                clearInterval(pingInterval);
                setTimeout(setupWebSocket, 3000);
            };

            return ws;
        };

        const ws = setupWebSocket();

        return newStore;
    }, [roomId]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const saveToStorage = useCallback(async (data: SerializedStore<TLRecord>) => {
        let attempts = 0;

        while (attempts < MAX_STORAGE_RETRY_ATTEMPTS) {
            try {
                const serialized = JSON.stringify(data);
                localStorage.setItem(`room_${roomId}`, serialized);
                return true;
            } catch (error: unknown) {
                if (error instanceof Error && (error.name === 'QuotaExceededError' || error.toString().includes('quota'))) {

                    attempts++;

                    // Try to free up space
                    if (attempts === 1) {
                        await cleanupStorage();
                        continue;
                    }

                    // If still failing, try removing older history
                    if (attempts === 2) {
                        const trimmedData = trimHistoryData(data);
                        try {
                            localStorage.setItem(`room_${roomId}`, JSON.stringify(trimmedData));
                            return true;
                        } catch (e) {
                            console.warn('Still unable to save after trimming history');
                        }
                    }
                }

                console.error('Failed to save to localStorage:', error);
                return false;
            }
        }

        return false;
    }, [roomId]);

    // Helper to cleanup storage
    const cleanupStorage = useCallback(async () => {
        const items = { ...localStorage };
        const totalSpace = JSON.stringify(items).length;
        const quota = await getStorageQuota();

        if (totalSpace / quota > STORAGE_CLEANUP_THRESHOLD) {
            // Remove old rooms first
            Object.keys(items)
                .filter(key => key.startsWith('room_') && key !== `room_${roomId}`)
                .sort((a, b) => {
                    const timeA = items[a]?.lastAccessed || 0;
                    const timeB = items[b]?.lastAccessed || 0;
                    return timeA - timeB;
                })
                .forEach(key => {
                    localStorage.removeItem(key);
                });
        }
    }, [roomId]);

    // Helper to trim history data
    const trimHistoryData = useCallback((data: SerializedStore<TLRecord>) => {
        if (!data || typeof data !== 'object') return data;

        // Create a shallow copy
        const trimmedData = { ...data } as { store?: { history?: unknown[] } };

        // Handle store's history at the root level
        if (trimmedData?.store?.history?.length) {
            trimmedData.store.history = trimmedData.store.history.slice(-100);
        }

        return trimmedData;
    }, []);

    return {
        store,
        isOnline,
    };
}

// Utility to get storage quota
async function getStorageQuota(): Promise<number> {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return estimate.quota || 5 * 1024 * 1024; // Default 5MB
    }
    return 5 * 1024 * 1024; // Default 5MB
} 