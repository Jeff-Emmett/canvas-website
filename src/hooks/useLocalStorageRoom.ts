import useLocalStorageState from 'use-local-storage-state';
import { TLRecord, createTLStore, SerializedStore } from 'tldraw';
import { customSchema } from '../../worker/TldrawDurableObject';
import { TLSocketRoom } from '@tldraw/sync-core';

export function useLocalStorageRoom(roomId: string) {
    const [records, setRecords] = useLocalStorageState<SerializedStore<TLRecord>>(`tldraw-room-${roomId}`, {
        defaultValue: createTLStore({ schema: customSchema }).serialize()
    });

    const store = createTLStore({
        schema: customSchema,
        initialData: records,
    });

    const socketRoom = new TLSocketRoom({
        initialSnapshot: {
            store: store.serialize(),
            schema: customSchema.serialize(),
        },
        schema: customSchema,
        onDataChange: () => {
            const serializedStore = store.serialize();
            setRecords(serializedStore);
            // Broadcast changes to other clients
            store.mergeRemoteChanges(() => Object.values(serializedStore));
        },
    });

    return {
        store,
        socketRoom,
        records,
        setRecords
    };
} 