import { SpatialIndex } from "@/propagators/SpatialIndex"
import { Box, Editor, TLShape, TLShapeId, VecLike, polygonsIntersect } from "tldraw"

export class Geo {
  editor: Editor
  spatialIndex: SpatialIndex
  constructor(editor: Editor) {
    this.editor = editor
    this.spatialIndex = new SpatialIndex(editor)
  }
  intersects(shape: TLShape | TLShapeId): boolean {
    const id = typeof shape === 'string' ? shape : shape?.id ?? null
    if (!id) return false
    const sourceTransform = this.editor.getShapePageTransform(id)
    const sourceGeo = this.editor.getShapeGeometry(id)
    const sourcePagespace = sourceTransform.applyToPoints(sourceGeo.vertices)
    const sourceBounds = this.editor.getShapePageBounds(id)

    const shapesInBounds = this.spatialIndex.getShapeIdsInsideBounds(sourceBounds as Box)
    for (const boundsShapeId of shapesInBounds) {
      if (boundsShapeId === id) continue
      const pageShape = this.editor.getShape(boundsShapeId)
      if (!pageShape) continue
      if (pageShape.type === 'arrow') continue
      const pageShapeGeo = this.editor.getShapeGeometry(pageShape)
      const pageShapeTransform = this.editor.getShapePageTransform(pageShape)
      const pageShapePagespace = pageShapeTransform.applyToPoints(pageShapeGeo.vertices)
      const pageShapeBounds = this.editor.getShapePageBounds(boundsShapeId)
      if (polygonsIntersect(sourcePagespace, pageShapePagespace) || sourceBounds?.contains(pageShapeBounds as Box) || pageShapeBounds?.contains(sourceBounds as Box)) {
        return true
      }
    }
    return false
  }
  distance(a: TLShape | TLShapeId, b: TLShape | TLShapeId): VecLike {
    const idA = typeof a === 'string' ? a : a?.id ?? null
    const idB = typeof b === 'string' ? b : b?.id ?? null
    if (!idA || !idB) return { x: 0, y: 0 }
    const shapeA = this.editor.getShape(idA)
    const shapeB = this.editor.getShape(idB)
    if (!shapeA || !shapeB) return { x: 0, y: 0 }
    return { x: shapeA.x - shapeB.x, y: shapeA.y - shapeB.y }
  }
  distanceCenter(a: TLShape | TLShapeId, b: TLShape | TLShapeId): VecLike {
    const idA = typeof a === 'string' ? a : a?.id ?? null
    const idB = typeof b === 'string' ? b : b?.id ?? null
    if (!idA || !idB) return { x: 0, y: 0 }
    const aBounds = this.editor.getShapePageBounds(idA)
    const bBounds = this.editor.getShapePageBounds(idB)
    if (!aBounds || !bBounds) return { x: 0, y: 0 }
    const aCenter = aBounds.center
    const bCenter = bBounds.center
    return { x: aCenter.x - bCenter.x, y: aCenter.y - bCenter.y }
  }
  getIntersects(shape: TLShape | TLShapeId): TLShape[] {
    const id = typeof shape === 'string' ? shape : shape?.id ?? null
    if (!id) return []
    const sourceTransform = this.editor.getShapePageTransform(id)
    const sourceGeo = this.editor.getShapeGeometry(id)
    const sourcePagespace = sourceTransform.applyToPoints(sourceGeo.vertices)
    const sourceBounds = this.editor.getShapePageBounds(id)

    const boundsShapes = this.spatialIndex.getShapeIdsInsideBounds(sourceBounds as Box)
    const overlaps: TLShape[] = []
    for (const boundsShapeId of boundsShapes) {
      if (boundsShapeId === id) continue
      const pageShape = this.editor.getShape(boundsShapeId)
      if (!pageShape) continue
      if (pageShape.type === 'arrow') continue
      const pageShapeGeo = this.editor.getShapeGeometry(pageShape)
      const pageShapeTransform = this.editor.getShapePageTransform(pageShape)
      const pageShapePagespace = pageShapeTransform.applyToPoints(pageShapeGeo.vertices)
      const pageShapeBounds = this.editor.getShapePageBounds(boundsShapeId)
      if (polygonsIntersect(sourcePagespace, pageShapePagespace) || sourceBounds?.contains(pageShapeBounds as Box) || pageShapeBounds?.contains(sourceBounds as Box )) {
        overlaps.push(pageShape)
      }
    }
    return overlaps
  }

  contains(shape: TLShape | TLShapeId): boolean {
    const id = typeof shape === 'string' ? shape : shape?.id ?? null
    if (!id) return false
    const sourceBounds = this.editor.getShapePageBounds(id)

    const boundsShapes = this.spatialIndex.getShapeIdsInsideBounds(sourceBounds as Box)
    for (const boundsShapeId of boundsShapes) {
      if (boundsShapeId === id) continue
      const pageShape = this.editor.getShape(boundsShapeId)
      if (!pageShape) continue
      if (pageShape.type !== 'geo') continue
      const pageShapeBounds = this.editor.getShapePageBounds(boundsShapeId)
      if (sourceBounds?.contains(pageShapeBounds as Box)) {
        return true
      }
    }
    return false
  }

  getContains(shape: TLShape | TLShapeId): TLShape[] {
    const id = typeof shape === 'string' ? shape : shape?.id ?? null
    if (!id) return []
    const sourceBounds = this.editor.getShapePageBounds(id)

    const boundsShapes = this.spatialIndex.getShapeIdsInsideBounds(sourceBounds as Box)
    const contains: TLShape[] = []
    for (const boundsShapeId of boundsShapes) {
      if (boundsShapeId === id) continue
      const pageShape = this.editor.getShape(boundsShapeId)
      if (!pageShape) continue
      if (pageShape.type !== 'geo') continue
      const pageShapeBounds = this.editor.getShapePageBounds(boundsShapeId)
      if (sourceBounds?.contains(pageShapeBounds as Box)) {
        contains.push(pageShape)
      }
    }
    return contains
  }
}