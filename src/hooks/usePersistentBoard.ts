import { useSync } from '@tldraw/sync'
import { useState, useEffect } from 'react'
import { customSchema } from '../../worker/TldrawDurableObject'
import { multiplayerAssetStore } from '../client/multiplayerAssetStore'
import { useGSetState } from './useGSetState'
import { useLocalStorageRoom } from './useLocalStorageRoom'
import { RecordType, BaseRecord } from '@tldraw/store'
import { TLRecord } from 'tldraw'

export function usePersistentBoard(roomId: string) {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const { store: localStore, records, setRecords } = useLocalStorageRoom(roomId)
    const { values, add, merge } = useGSetState(roomId)

    const getWebSocketUrl = (baseUrl: string) => {
        // Remove any trailing slashes
        baseUrl = baseUrl.replace(/\/$/, '')

        // Handle different protocols
        if (baseUrl.startsWith('https://')) {
            return baseUrl.replace('https://', 'wss://')
        } else if (baseUrl.startsWith('http://')) {
            return baseUrl.replace('http://', 'ws://')
        }
        return baseUrl
    }

    const syncedStore = useSync({
        uri: import.meta.env.TLDRAW_WORKER_URL
            ? `${getWebSocketUrl(import.meta.env.TLDRAW_WORKER_URL)}/connect/${roomId}`
            : `wss://jeffemmett-canvas.jeffemmett.workers.dev/connect/${roomId}`,
        schema: customSchema,
        assets: multiplayerAssetStore,
    })

    // Handle online/offline status
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

    // Handle online/offline synchronization
    useEffect(() => {
        if (isOnline && syncedStore?.store) {
            // Sync server records to local
            const serverRecords = Object.values(syncedStore.store.allRecords())
            merge(new Set(serverRecords))

            // Set up store change listener
            const unsubscribe = syncedStore.store.listen((event) => {
                if ('changes' in event) {
                    const changedRecords = Object.values(event.changes)
                    merge(new Set(changedRecords))
                    // Also update local storage
                    setRecords(syncedStore.store.serialize())
                }
            })

            return () => unsubscribe()
        } else if (!isOnline && localStore) {
            // When going offline, ensure we have the latest state in local storage
            const currentRecords = Object.values(localStore.allRecords())
            merge(new Set(currentRecords))
        }
    }, [isOnline, syncedStore?.store, localStore])

    return {
        store: isOnline ? syncedStore?.store : localStore,
        isOnline,
        addRecord: (record: TLRecord) => {
            add(record)
            if (!isOnline) {
                setRecords(localStore.serialize())
            }
        },
        mergeRecords: merge
    }
} 