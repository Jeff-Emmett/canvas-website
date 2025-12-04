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
    // NOTE: Index assignment is handled by assignSequentialIndices() during format conversion
    // Here we validate using tldraw's fractional indexing rules
    // The first letter encodes integer part length: a=1 digit, b=2 digits, c=3 digits, etc.
    // Examples: "a0"-"a9", "b10"-"b99", "c100"-"c999", with optional fraction "a1V4rr"
    // Invalid: "b1" (b expects 2 digits but has 1)
    if (!sanitized.index || typeof sanitized.index !== 'string' || sanitized.index.length === 0) {
      sanitized.index = 'a1'
    } else {
      // Validate fractional indexing format
      let isValid = false
      const prefix = sanitized.index[0]
      const rest = sanitized.index.slice(1)

      if (/^[a-zA-Z]/.test(sanitized.index) && /^[a-zA-Z][a-zA-Z0-9]+$/.test(sanitized.index)) {
        if (prefix >= 'a' && prefix <= 'z') {
          // Calculate expected minimum digit count: a=1, b=2, c=3, etc.
          const expectedDigits = prefix.charCodeAt(0) - 'a'.charCodeAt(0) + 1
          const integerMatch = rest.match(/^(\d+)/)
          if (integerMatch && integerMatch[1].length >= expectedDigits) {
            isValid = true
          }
        } else if (prefix >= 'A' && prefix <= 'Z') {
          // Uppercase for negative/special indices - allow
          isValid = true
        }
      }

      if (!isValid) {
        console.warn(`⚠️ MinimalSanitization: Invalid index format "${sanitized.index}" for shape ${sanitized.id}`)
        sanitized.index = 'a1'
      }
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















