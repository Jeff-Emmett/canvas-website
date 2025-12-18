/**
 * Automerge test helpers for mocking CRDT documents and sync
 */

import type { TLShapeId, TLRecord, TLShape } from 'tldraw'

/**
 * Create a minimal test Automerge document structure
 */
export function createTestDocument() {
  return {
    store: {} as Record<string, TLRecord>,
    schema: {
      schemaVersion: 1,
      storeVersion: 4,
      recordVersions: {
        asset: { version: 1, subTypeKey: 'type', subTypeVersions: { image: 1, video: 1, bookmark: 0 } },
        camera: { version: 1 },
        document: { version: 2 },
        instance: { version: 24 },
        instance_page_state: { version: 5 },
        page: { version: 1 },
        shape: { version: 3, subTypeKey: 'type', subTypeVersions: {} },
        pointer: { version: 1 },
        instance_presence: { version: 5 },
        binding: { version: 1, subTypeKey: 'type', subTypeVersions: { arrow: 0 } }
      }
    }
  }
}

/**
 * Create a test TLDraw shape
 */
export function createTestShape(
  id: string,
  type: string = 'geo',
  props: Partial<TLShape['props']> = {}
): TLShape {
  const shapeId = id.startsWith('shape:') ? id : `shape:${id}`

  return {
    id: shapeId as TLShapeId,
    type,
    x: 100,
    y: 100,
    rotation: 0,
    props: {
      geo: 'rectangle',
      w: 100,
      h: 100,
      color: 'black',
      fill: 'none',
      dash: 'draw',
      size: 'm',
      ...props,
    },
    parentId: 'page:page' as any,
    index: 'a1',
    typeName: 'shape',
    isLocked: false,
    opacity: 1,
    meta: {},
  } as TLShape
}

/**
 * Create a test page record
 */
export function createTestPage(id: string = 'page:page', name: string = 'Page 1') {
  return {
    id,
    name,
    index: 'a0',
    typeName: 'page',
    meta: {},
  }
}

/**
 * Create a test canvas snapshot with shapes
 */
export function createTestSnapshot(shapes: TLShape[] = []) {
  const doc = createTestDocument()

  // Add default page
  doc.store['page:page'] = createTestPage()

  // Add shapes
  for (const shape of shapes) {
    doc.store[shape.id] = shape
  }

  return doc
}

/**
 * Simulate an Automerge patch for a shape update
 */
export function createShapePatch(
  shapeId: string,
  action: 'put' | 'del',
  props?: Partial<TLShape>
) {
  const id = shapeId.startsWith('shape:') ? shapeId : `shape:${shapeId}`

  if (action === 'del') {
    return {
      path: ['store', id],
      action: 'del',
    }
  }

  return {
    path: ['store', id],
    action: 'put',
    value: props,
  }
}

/**
 * Create a series of patches that simulate CRDT updates
 */
export function createSyncPatches(
  shapes: Array<{ id: string; action: 'put' | 'del'; props?: Partial<TLShape> }>
) {
  return shapes.map(({ id, action, props }) => createShapePatch(id, action, props))
}

/**
 * Create binary sync message mock (ArrayBuffer)
 */
export function createMockSyncMessage(): ArrayBuffer {
  // Simple mock - real Automerge sync messages are more complex
  const encoder = new TextEncoder()
  const data = encoder.encode('mock-sync-message')
  return data.buffer
}

/**
 * Mock sync state for peer tracking
 */
export interface MockSyncState {
  peerId: string
  lastSeen: number
  hasUnsyncedChanges: boolean
}

export function createMockSyncState(peerId: string): MockSyncState {
  return {
    peerId,
    lastSeen: Date.now(),
    hasUnsyncedChanges: false,
  }
}

/**
 * Helper to simulate concurrent edits for conflict testing
 */
export function simulateConcurrentEdits(
  shape: TLShape,
  edits: Array<{ actor: string; changes: Partial<TLShape> }>
) {
  // Return list of changes with actor metadata
  return edits.map((edit, index) => ({
    actor: edit.actor,
    timestamp: Date.now() + index, // Slight offset for ordering
    changes: edit.changes,
    originalShape: shape,
  }))
}
