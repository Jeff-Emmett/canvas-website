// Minimal sanitization - only fix critical issues that break TLDraw
function minimalSanitizeRecord(record: any): any {
  const sanitized = { ...record }
  
  // Only fix critical structural issues
  if (!sanitized.id) {
    throw new Error("Record missing required id field")
  }
  
  if (!sanitized.typeName) {
    throw new Error("Record missing required typeName field")
  }
  
  // For shapes, only ensure basic required fields exist
  if (sanitized.typeName === 'shape') {
    // Ensure required shape fields exist with defaults
    if (typeof sanitized.x !== 'number') sanitized.x = 0
    if (typeof sanitized.y !== 'number') sanitized.y = 0
    if (typeof sanitized.rotation !== 'number') sanitized.rotation = 0
    if (typeof sanitized.isLocked !== 'boolean') sanitized.isLocked = false
    if (typeof sanitized.opacity !== 'number') sanitized.opacity = 1
    if (!sanitized.meta || typeof sanitized.meta !== 'object') sanitized.meta = {}
    // CRITICAL: IndexKey must follow tldraw's fractional indexing format
    // Valid format: starts with 'a' followed by digits, optionally followed by uppercase letters
    // Examples: "a1", "a2", "a10", "a1V" (fractional between a1 and a2)
    // Invalid: "c1", "b1", "z999" (must start with 'a')
    if (!sanitized.index || typeof sanitized.index !== 'string' || !/^a\d+[A-Z]*$/.test(sanitized.index)) {
      sanitized.index = 'a1'
    }
    if (!sanitized.parentId) sanitized.parentId = 'page:page'
    
    // Ensure props object exists
    if (!sanitized.props || typeof sanitized.props !== 'object') {
      sanitized.props = {}
    }
    
    // Only fix type if completely missing
    if (!sanitized.type || typeof sanitized.type !== 'string') {
      // Simple type inference - check for obvious indicators
      // CRITICAL: Don't infer text type just because richText exists - geo and note shapes can have richText
      // Only infer text if there's no geo property and richText exists
      if ((sanitized.props?.richText || sanitized.props?.text) && !sanitized.props?.geo) {
        sanitized.type = 'text'
      } else if (sanitized.props?.geo) {
        sanitized.type = 'geo'
      } else {
        sanitized.type = 'geo' // Safe default
      }
    }
  }
  
  return sanitized
}















