import { useSync } from '@tldraw/sync'
import { useState, useEffect, useCallback, useRef } from 'react'
import { customSchema } from '../../worker/TldrawDurableObject'
import { multiplayerAssetStore } from '../client/multiplayerAssetStore'
import { useGSetState } from './useGSetState'
import { useLocalStorageRoom } from './useLocalStorageRoom'
import { TLRecord } from 'tldraw'
import { WORKER_URL } from '../components/Board'

export function usePersistentBoard(roomId: string) {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const { store: localStore, records, setRecords } = useLocalStorageRoom(roomId)
    const { values, add, merge } = useGSetState(roomId)
    const initialSyncRef = useRef(false)
    const mergeInProgressRef = useRef(false)

    const syncedStore = useSync({
        uri: `${WORKER_URL.replace('https://', 'wss://')}/connect/${roomId}`,
        schema: customSchema,
        assets: multiplayerAssetStore,
    })

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const mergeRecords = useCallback((records: Set<TLRecord>) => {
        if (mergeInProgressRef.current || records.size === 0) return

        try {
            mergeInProgressRef.current = true
            merge(records)
            if (!isOnline && localStore) {
                setRecords(localStore.serialize())
            }
        } finally {
            mergeInProgressRef.current = false
        }
    }, [isOnline, localStore, merge, setRecords])

    useEffect(() => {
        if (!syncedStore?.store || !localStore) return

        if (isOnline && !initialSyncRef.current) {
            initialSyncRef.current = true
            const serverRecords = Object.values(syncedStore.store.allRecords())
            if (serverRecords.length > 0) {
                mergeRecords(new Set(serverRecords))
            }

            const unsubscribe = syncedStore.store.listen((event) => {
                if ('changes' in event) {
                    const changedRecords = Object.values(event.changes)
                    if (changedRecords.length > 0) {
                        mergeRecords(new Set(changedRecords))
                    }
                }
            })

            return () => unsubscribe()
        } else if (!isOnline) {
            const currentRecords = Object.values(localStore.allRecords())
            if (currentRecords.length > 0) {
                mergeRecords(new Set(currentRecords))
            }
        }
    }, [isOnline, syncedStore?.store, localStore, mergeRecords])

    const addRecord = useCallback((record: TLRecord) => {
        if (!record) return
        add(record)
        if (!isOnline && localStore) {
            setRecords(localStore.serialize())
        }
    }, [add, isOnline, localStore, setRecords])

    return {
        store: isOnline ? syncedStore?.store : localStore,
        isOnline,
        addRecord,
        mergeRecords
    }
} 