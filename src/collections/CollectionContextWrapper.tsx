import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TLShape, Editor } from '@tldraw/tldraw';
import { BaseCollection } from './BaseCollection';

interface CollectionContextValue {
  get: (id: string) => BaseCollection | undefined;
}

type Collection = (new (editor: Editor) => BaseCollection)

interface CollectionContextWrapperProps {
  editor: Editor | null;
  collections: Collection[];
  children: React.ReactNode;
}

const CollectionContext = createContext<CollectionContextValue | undefined>(undefined);

export const CollectionContextWrapper: React.FC<CollectionContextWrapperProps> = ({ 
  editor, 
  collections: collectionClasses, 
  children 
}) => {
  const [collections, setCollections] = useState<Map<string, BaseCollection> | null>(null);

  // Handle shape property changes
  const handleShapeChange = (prev: TLShape, next: TLShape) => {
    if (!collections) return;
    for (const collection of collections.values()) {
      if (collection.getShapes().has(next.id)) {
        collection._onShapeChange(prev, next);
      }
    }
  };

  // Handle shape deletions
  const handleShapeDelete = (shape: TLShape) => {
    if (!collections) return;
    for (const collection of collections.values()) {
      collection.remove([shape]);
    }
  };

  useEffect(() => {
    if (editor) {
      const initializedCollections = new Map<string, BaseCollection>();
      for (const ColClass of collectionClasses) {
        const instance = new ColClass(editor);
        initializedCollections.set(instance.id, instance);
      }
      setCollections(initializedCollections);
    }
  }, [editor, collectionClasses]);

  // Subscribe to shape changes in the editor
  useEffect(() => {
    if (editor && collections) {
      editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
        handleShapeChange(prev, next);
      });
    }
  }, [editor, collections]);

  // Subscribe to shape deletions in the editor
  useEffect(() => {
    if (editor && collections) {
      editor.sideEffects.registerAfterDeleteHandler('shape', (prev) => {
        handleShapeDelete(prev);
      });
    }
  }, [editor, collections]);

  const value = useMemo(() => ({
    get: (id: string) => collections?.get(id),
  }), [collections]);

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
};

// Hook to use collection context within the wrapper
export const useCollectionContext = <T extends BaseCollection = BaseCollection>(
  collectionId: string
): { collection: T | null; size: number } => {
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
    const unsubscribe = collection.subscribe(() => {
      setSize(collection.size);
    });

    setSize(collection.size);
    return unsubscribe;
  }, [collection]);

  return { collection: collection as T, size };
}; 