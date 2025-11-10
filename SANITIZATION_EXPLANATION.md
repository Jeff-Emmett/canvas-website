# Sanitization Explanation

## Why Sanitization Exists

Sanitization is **necessary** because TLDraw has strict schema requirements that must be met for shapes to render correctly. Without sanitization, we get validation errors and broken shapes.

## Critical Fixes (MUST KEEP)

These fixes are **required** for TLDraw to work:

1. **Move w/h/geo from top-level to props for geo shapes**
   - TLDraw schema requires `w`, `h`, and `geo` to be in `props`, not at the top level
   - Without this, TLDraw throws validation errors

2. **Remove w/h from group shapes**
   - Group shapes don't have `w`/`h` properties
   - Having them causes validation errors

3. **Remove w/h from line shapes**
   - Line shapes use `points`, not `w`/`h`
   - Having them causes validation errors

4. **Fix richText structure**
   - TLDraw requires `richText` to be `{ content: [...], type: 'doc' }`
   - Old data might have it as an array or missing structure
   - We preserve all content, just fix the structure

5. **Fix crop structure for image/video**
   - TLDraw requires `crop` to be `{ topLeft: {x,y}, bottomRight: {x,y} }` or `null`
   - Old data might have `{ x, y, w, h }` format
   - We convert the format, preserving the crop area

6. **Remove h/geo from text shapes**
   - Text shapes don't have `h` or `geo` properties
   - Having them causes validation errors

7. **Ensure required properties exist**
   - Some shapes require certain properties (e.g., `points` for line shapes)
   - We only add defaults if truly missing

## What We Preserve

We **preserve all user data**:
- ✅ `richText` content (we only fix structure, never delete content)
- ✅ `text` property on arrows
- ✅ All metadata (`meta` object)
- ✅ All valid shape properties
- ✅ Custom shape properties

## What We Remove (Only When Necessary)

We only remove properties that:
1. **Cause validation errors** (e.g., `w`/`h` on groups/lines)
2. **Are invalid for the shape type** (e.g., `geo` on text shapes)

We **never** remove:
- User-created content (text, richText)
- Valid metadata
- Properties that don't cause errors

## Current Sanitization Locations

1. **TLStoreToAutomerge.ts** - When saving from TLDraw to Automerge
   - Minimal fixes only
   - Preserves all data

2. **AutomergeToTLStore.ts** - When loading from Automerge to TLDraw
   - Minimal fixes only
   - Preserves all data

3. **useAutomergeStoreV2.ts** - Initial load processing
   - More extensive (handles migration from old formats)
   - Still preserves all user data

## Can We Simplify?

**Yes, but carefully:**

1. ✅ We can remove property deletions that don't cause validation errors
2. ✅ We can consolidate duplicate logic
3. ❌ We **cannot** remove schema fixes (w/h/geo movement, richText structure)
4. ❌ We **cannot** remove property deletions that cause validation errors

## Recommendation

Keep sanitization but:
1. Only delete properties that **actually cause validation errors**
2. Preserve all user data (text, richText, metadata)
3. Consolidate duplicate logic between files
4. Add comments explaining why each fix is necessary

