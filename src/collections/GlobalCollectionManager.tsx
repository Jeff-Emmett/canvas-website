import { useEffect, useState } from 'react';
import { Editor, TLShape } from '@tldraw/tldraw';
import { BaseCollection } from './BaseCollection';

type Collection = (new (editor: Editor) => BaseCollection)

class GlobalCollectionManager {
  private static instance: GlobalCollectionManager;
  private collections: Map<string, BaseCollection> = new Map();
  private editor: Editor | null = null;
  private listeners: Set<() => void> = new Set();

  static getInstance(): GlobalCollectionManager {
    if (!GlobalCollectionManager.instance) {
      GlobalCollectionManager.instance = new GlobalCollectionManager();
    }
    return GlobalCollectionManager.instance;
  }

  initialize(editor: Editor, collectionClasses: Collection[]) {
    this.editor = editor;
    this.collections.clear();

    for (const ColClass of collectionClasses) {
      const instance = new ColClass(editor);
      this.collections.set(instance.id, instance);
    }

    // Subscribe to shape changes
    editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
      this.handleShapeChange(prev, next);
    });

    // Subscribe to shape deletions
    editor.sideEffects.registerAfterDeleteHandler('shape', (prev) => {
      this.handleShapeDelete(prev);
    });

    this.notifyListeners();
  }

  private handleShapeChange(prev: TLShape, next: TLShape) {
    for (const collection of this.collections.values()) {
      if (collection.getShapes().has(next.id)) {
        collection._onShapeChange(prev, next);
      }
    }
  }

  private handleShapeDelete(shape: TLShape) {
    for (const collection of this.collections.values()) {
      collection.remove([shape]);
    }
  }

  getCollection(id: string): BaseCollection | undefined {
    return this.collections.get(id);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

// Hook to use the global collection manager
export const useGlobalCollection = (collectionId: string) => {
  const [collection, setCollection] = useState<BaseCollection | null>(null);
  const [size, setSize] = useState<number>(0);

  useEffect(() => {
    const manager = GlobalCollectionManager.getInstance();
    
    const unsubscribe = manager.subscribe(() => {
      const newCollection = manager.getCollection(collectionId);
      setCollection(newCollection || null);
      setSize(newCollection?.size || 0);
    });

    // Initial setup
    const initialCollection = manager.getCollection(collectionId);
    setCollection(initialCollection || null);
    setSize(initialCollection?.size || 0);

    return unsubscribe;
  }, [collectionId]);

  useEffect(() => {
    if (collection) {
      const unsubscribe = collection.subscribe(() => {
        setSize(collection.size);
      });
      return unsubscribe;
    }
  }, [collection]);

  return { collection, size };
};

// Function to initialize the global collection manager
export const initializeGlobalCollections = (editor: Editor, collectionClasses: Collection[]) => {
  const manager = GlobalCollectionManager.getInstance();
  manager.initialize(editor, collectionClasses);
}; 