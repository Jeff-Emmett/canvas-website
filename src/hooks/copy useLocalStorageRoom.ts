import useLocalStorageState from 'use-local-storage-state';
import { TLRecord, createTLStore, SerializedStore, Editor, StoreSchema, TLStoreProps } from '@tldraw/tldraw';
import { customSchema } from '../../worker/TldrawDurableObject';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useSync } from '@tldraw/sync';
import { WORKER_URL } from '../components/Board';
import { TLRecord as TLSchemaRecord } from '@tldraw/tlschema'
import { defaultAssetUrls } from '@tldraw/assets'

const CACHE_VERSION = '1.0';

export function useLocalStorageRoom(roomId: string) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const storageKey = `tldraw_board_${roomId}_v${CACHE_VERSION}`;

    const [records, setRecords] = useLocalStorageState<SerializedStore<TLRecord>>(storageKey, {
        defaultValue: createTLStore({
            schema: customSchema as unknown as StoreSchema<TLRecord, unknown>
        }).serialize()
    });

    // Create a persistent store
    const baseStore = useMemo(() => {
        return createTLStore({
            schema: customSchema as unknown as StoreSchema<TLRecord, unknown>,
            initialData: records,
        })
    }, [records]);

    // Use sync with the base store
    const syncedStore = useSync({
        uri: `${WORKER_URL.replace('https://', 'wss://')}/connect/${roomId}`,
        schema: customSchema,
        store: baseStore,
        assets: defaultAssetUrls
    });

    // Handle online/offline transitions
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (syncedStore?.store) {
                const filteredRecords = filterNonCameraRecords(records);
                syncedStore.store.mergeRemoteChanges(() => {
                    Object.values(filteredRecords).forEach(record => {
                        syncedStore.store.put([record as unknown as TLSchemaRecord]);
                    });
                });
            }
        };

        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [records, syncedStore?.store]);

    const filterNonCameraRecords = (data: SerializedStore<TLRecord>) => {
        return Object.fromEntries(
            Object.entries(data).filter(([_, record]) => {
                return (record as TLRecord).typeName !== 'camera' &&
                    (record as TLRecord).typeName !== 'instance_page_state' &&
                    (record as TLRecord).typeName !== 'instance_presence';
            })
        ) as SerializedStore<TLRecord>;
    };

    // Sync with server store when online
    useEffect(() => {
        if (!isOnline || !syncedStore?.store) return;

        const syncInterval = setInterval(() => {
            const serverRecords = syncedStore.store.allRecords();
            if (Object.keys(serverRecords).length > 0) {
                setRecords(syncedStore.store.serialize() as typeof records);
            }
        }, 5000);

        return () => clearInterval(syncInterval);
    }, [isOnline, syncedStore?.store, setRecords]);

    const store = useMemo(() => {
        if (isOnline && syncedStore?.store) {
            return syncedStore.store;
        }
        return createTLStore({
            schema: customSchema as unknown as StoreSchema<TLRecord, unknown>,
            initialData: records,
        });
    }, [isOnline, syncedStore?.store, records]);

    return {
        store,
        records,
        setRecords,
        isOnline
    };
} 