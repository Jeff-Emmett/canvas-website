import { useContext, useEffect, useState } from "react";
import { CollectionContext } from "./CollectionProvider";
import { BaseCollection } from "./BaseCollection";

export const useCollection = <T extends BaseCollection = BaseCollection>(collectionId: string): { collection: T | null; size: number } => {
  const context = useContext(CollectionContext);
  
  if (!context) {
    return { collection: null, size: 0 };
  }

  const collection = context.get(collectionId);
  if (!collection) {
    return { collection: null, size: 0 };
  }

  const [size, setSize] = useState<number>(collection.size);

  useEffect(() => {
    // Subscribe to collection changes
    const unsubscribe = collection.subscribe(() => {
      setSize(collection.size);
    });

    // Set initial size
    setSize(collection.size);

    return unsubscribe; // Cleanup on unmount
  }, [collection]);

  return { collection: collection as T, size };
};