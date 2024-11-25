import useLocalStorageState from 'use-local-storage-state';
import GSet from 'crdts/src/G-Set';
import { TLRecord } from 'tldraw';

export function useGSetState(roomId: string) {
    const [localSet, setLocalSet] = useLocalStorageState<TLRecord[]>(`gset-${roomId}`, {
        defaultValue: []
    });

    const gset = new GSet<TLRecord>();

    // Initialize G-Set with local data
    if (localSet && Array.isArray(localSet)) {
        localSet.forEach(record => gset.add(record));
    }

    const addRecord = (record: TLRecord) => {
        gset.add(record);
        setLocalSet(Array.from(gset.values()));
    };

    const merge = (remoteSet: Set<TLRecord>) => {
        remoteSet.forEach(record => gset.add(record));
        setLocalSet(Array.from(gset.values()));
        return gset.values();
    };

    return {
        values: gset.values(),
        add: addRecord,
        merge,
        localSet
    };
} 