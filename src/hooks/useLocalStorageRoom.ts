import useLocalStorageState from 'use-local-storage-state';
import { TLRecord, createTLStore, SerializedStore } from 'tldraw';
import { customSchema } from '../../worker/TldrawDurableObject';

export function useLocalStorageRoom(roomId: string) {
    const [records, setRecords] = useLocalStorageState<SerializedStore<TLRecord>>(`tldraw-room-${roomId}`, {
        defaultValue: createTLStore({ schema: customSchema }).serialize()
    });

    const store = createTLStore({
        schema: customSchema,
        initialData: records,
    });

    return {
        store,
        records,
        setRecords
    };
} 