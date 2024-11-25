import useLocalStorageState from 'use-local-storage-state';
import GSet from 'crdts/src/G-Set';
import { TLRecord } from 'tldraw';
import { useRef, useCallback } from 'react';

export function useGSetState(roomId: string) {
    const [localSet, setLocalSet] = useLocalStorageState<TLRecord[]>(`gset-${roomId}`, {
        defaultValue: []
    });

    // Keep GSet instance in a ref to persist between renders
    const gsetRef = useRef<GSet<TLRecord>>();
    if (!gsetRef.current) {
        gsetRef.current = new GSet<TLRecord>();
        // Initialize G-Set with local data
        if (localSet && Array.isArray(localSet)) {
            localSet.forEach(record => gsetRef.current?.add(record));
        }
    }

    const addRecord = useCallback((record: TLRecord) => {
        if (!gsetRef.current) return;
        gsetRef.current.add(record);
        setLocalSet(Array.from(gsetRef.current.values()));
    }, [setLocalSet]);

    const merge = useCallback((remoteSet: Set<TLRecord>) => {
        if (!gsetRef.current) return new Set<TLRecord>();
        remoteSet.forEach(record => gsetRef.current?.add(record));
        setLocalSet(Array.from(gsetRef.current.values()));
        return gsetRef.current.values();
    }, [setLocalSet]);

    return {
        values: gsetRef.current.values(),
        add: addRecord,
        merge,
        localSet
    };
} 