# Collections System

This directory contains a proof-of-concept collections system for @tldraw that allows you to group and track shapes with custom logic.

## Overview

The collections system provides a way to:
- Group shapes together with custom logic
- React to shape additions, removals, and changes
- Subscribe to collection changes in React components
- Maintain collections across shape modifications

## Files

- `BaseCollection.ts` - Abstract base class for all collections
- `CollectionProvider.tsx` - React context provider for collections
- `useCollection.ts` - React hook for accessing collections
- `ExampleCollection.ts` - Example collection implementation
- `ExampleCollectionComponent.tsx` - Example React component using collections
- `index.ts` - Exports all collection-related modules

## Usage

### 1. Create a Collection

Extend `BaseCollection` to create your own collection:

```typescript
import { BaseCollection } from '@/collections';
import { TLShape } from '@tldraw/tldraw';

export class MyCollection extends BaseCollection {
  id = 'my-collection';

  protected onAdd(shapes: TLShape[]): void {
    console.log(`Added ${shapes.length} shapes to my collection`);
    // Add your custom logic here
  }

  protected onRemove(shapes: TLShape[]): void {
    console.log(`Removed ${shapes.length} shapes from my collection`);
    // Add your custom logic here
  }

  protected onShapeChange(prev: TLShape, next: TLShape): void {
    console.log('Shape changed in my collection:', { prev, next });
    // Add your custom logic here
  }

  protected onMembershipChange(): void {
    console.log(`My collection membership changed. Total shapes: ${this.size}`);
    // Add your custom logic here
  }
}
```

### 2. Set up the CollectionProvider

Wrap your Tldraw component with the CollectionProvider:

```typescript
import { CollectionProvider } from '@/collections';

function MyComponent() {
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <div>
      {editor && (
        <CollectionProvider editor={editor} collections={[MyCollection]}>
          <Tldraw
            onMount={(editor) => setEditor(editor)}
            // ... other props
          />
        </CollectionProvider>
      )}
    </div>
  );
}
```

### 3. Use Collections in React Components

Use the `useCollection` hook to access collections:

```typescript
import { useCollection } from '@/collections';

function MyComponent() {
  const { collection, size } = useCollection<MyCollection>('my-collection');

  const handleAddShapes = () => {
    const selectedShapes = collection.editor.getSelectedShapes();
    if (selectedShapes.length > 0) {
      collection.add(selectedShapes);
    }
  };

  return (
    <div>
      <p>Collection size: {size}</p>
      <button onClick={handleAddShapes}>Add Selected Shapes</button>
    </div>
  );
}
```

## API Reference

### BaseCollection

#### Methods

- `add(shapes: TLShape[])` - Add shapes to the collection
- `remove(shapes: TLShape[])` - Remove shapes from the collection
- `clear()` - Remove all shapes from the collection
- `getShapes(): Map<TLShapeId, TLShape>` - Get all shapes in the collection
- `subscribe(listener: () => void): () => void` - Subscribe to collection changes

#### Properties

- `size: number` - Number of shapes in the collection
- `editor: Editor` - Reference to the tldraw editor

#### Protected Methods (Override these)

- `onAdd(shapes: TLShape[])` - Called when shapes are added
- `onRemove(shapes: TLShape[])` - Called when shapes are removed
- `onShapeChange(prev: TLShape, next: TLShape)` - Called when a shape changes
- `onMembershipChange()` - Called when collection membership changes

### useCollection Hook

```typescript
const { collection, size } = useCollection<T extends BaseCollection>(collectionId: string)
```

Returns:
- `collection: T` - The collection instance
- `size: number` - Current number of shapes in the collection

## Example

See `ExampleCollection.ts` and `ExampleCollectionComponent.tsx` for a complete working example that demonstrates:

- Creating a custom collection
- Setting up the CollectionProvider
- Using the useCollection hook
- Adding/removing shapes from collections
- Reacting to collection changes

The example is integrated into the Board component and provides a UI for testing the collection functionality.