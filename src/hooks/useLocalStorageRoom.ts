import { useCallback, useEffect, useState, useMemo } from 'react';
import { createTLStore, TLAsset, TLAssetStore } from 'tldraw';
import { useSync } from '@tldraw/sync';
import { customSchema } from '../../worker/TldrawDurableObject';
import { WORKER_URL } from '../components/Board';
import { SerializedStore, StoreSchema } from '@tldraw/store';
import { TLRecord } from '@tldraw/tlschema';
import { TLStoreSchemaOptions } from '@tldraw/editor';
import { Store } from '@tldraw/store'

const MAX_STORAGE_RETRY_ATTEMPTS = 3;
const STORAGE_CLEANUP_THRESHOLD = 0.9; // 90% of quota

export function useLocalStorageRoom(roomId: string) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [ws, setWs] = useState<WebSocket | null>(null);

    const store = useMemo(() => {
        const savedData = localStorage.getItem(`tldraw-store-${roomId}`);
        let initialData;

        if (savedData) {
            try {
                initialData = JSON.parse(savedData);
            } catch (e) {
                console.error('Error parsing stored data:', e);
            }
        }

        return createTLStore({
            schema: customSchema,
            initialData: initialData as SerializedStore<TLRecord> | undefined,
        });
    }, [roomId]);

    // Setup WebSocket in a separate useEffect
    useEffect(() => {
        const setupWebSocket = () => {
            const isLocalhost = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';

            const baseUrl = isLocalhost
                ? `ws://${window.location.hostname}:5172`
                : WORKER_URL.replace('https://', 'wss://');

            const ws = new WebSocket(`${baseUrl}/connect/${roomId}`);
            setWs(ws);  // Store WebSocket instance

            ws.onopen = () => {
                console.log('WebSocket connected successfully');
                setIsOnline(true);
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('WebSocket message received:', message);

                if (message.type === 'initial-state') {
                    const { records } = message.data;
                    if (records && Array.isArray(records) && records.length > 0) {
                        console.log('Server records:', records);
                        store.mergeRemoteChanges(() => {
                            const validRecords = records.filter(
                                (record: TLRecord) => record && record.typeName && customSchema.types[record.typeName]
                            );
                            if (validRecords.length > 0) {
                                store.put(validRecords);
                            }
                        });
                    }
                } else if (message.type === 'update') {
                    store.mergeRemoteChanges(() => {
                        if (message.data?.length > 0) {
                            const validRecords = message.data.filter(
                                (record: TLRecord) => record && record.typeName && customSchema.types[record.typeName]
                            );
                            if (validRecords.length > 0) {
                                store.put(validRecords);
                            }
                        }
                    });
                }
            };

            // Keep connection alive
            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);

            return {
                close: () => {
                    clearInterval(pingInterval);
                    ws.close();
                }
            };
        };

        const { close } = setupWebSocket();
        let heartbeatInterval: NodeJS.Timeout;
        let reconnectTimeout: NodeJS.Timeout;

        const cleanup = () => {
            clearInterval(heartbeatInterval);
            clearTimeout(reconnectTimeout);
            close();
            setWs(null);
        };

        // WebSocket event handlers
        if (ws) {
            ws.onopen = () => {
                console.log('WebSocket connected successfully');
                heartbeatInterval = setInterval(() => {
                    if (ws?.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('WebSocket message received:', message);

                if (message.type === 'initial-state') {
                    store.mergeRemoteChanges(() => {
                        if (message.data.records?.length > 0) {
                            const validRecords = message.data.records.filter((record: TLRecord) =>
                                record && record.typeName &&
                                (customSchema.types[record.typeName] ||
                                    record.typeName === 'document' ||
                                    record.typeName === 'page')
                            );
                            if (validRecords.length > 0) {
                                store.put(validRecords);
                            }
                        }
                    });
                } else if (message.type === 'update') {
                    store.mergeRemoteChanges(() => {
                        if (Array.isArray(message.data)) {
                            store.put(message.data);
                        }
                    });
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = (event) => {
                console.log(`WebSocket closed with code: ${event.code} reason: ${event.reason}`);
                clearInterval(heartbeatInterval);

                // Attempt to reconnect unless explicitly closed
                if (event.code !== 1000) {
                    console.log('Attempting to reconnect...');
                    reconnectTimeout = setTimeout(() => {
                        cleanup();
                        setupWebSocket();
                    }, 3000);
                }
            };

            // Add store listener
            const unsubscribe = store.listen(() => {
                if (ws?.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'update',
                        data: Array.from(store.allRecords())
                    }));
                }
            });

            return () => {
                cleanup();
                unsubscribe();
            };
        }
    }, [store, roomId]);

    return { store, isOnline };
}

// Utility to get storage quota
async function getStorageQuota(): Promise<number> {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return estimate.quota || 5 * 1024 * 1024; // Default 5MB
    }
    return 5 * 1024 * 1024; // Default 5MB
}

// Helper function to compare server and local data
function shouldUpdateFromServer(
    serverRecords: TLRecord[],
    localRecords: TLRecord[]
): boolean {
    // If we have no local records, accept server records
    if (localRecords.length === 0) return true;

    // Compare the latest timestamp from each set of records
    const serverLatest = Math.max(...serverRecords.map(r => r.meta?.updatedAt ?? 0) as number[]);
    const localLatest = Math.max(...localRecords.map(r => r.meta?.updatedAt ?? 0) as number[]);

    return serverLatest > localLatest;
} 