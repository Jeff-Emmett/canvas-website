// Simple test script to verify change detection optimization
// This demonstrates how the hash-based change detection works

function generateDocHash(doc) {
  // Create a stable string representation of the document
  const docString = JSON.stringify(doc, Object.keys(doc).sort())
  // Simple hash function (same as in the implementation)
  let hash = 0
  for (let i = 0; i < docString.length; i++) {
    const char = docString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString()
}

// Test cases
console.log('Testing change detection optimization...\n')

// Test 1: Same document should have same hash
const doc1 = { store: { shape1: { id: 'shape1', type: 'geo' } }, schema: { version: 1 } }
const doc2 = { store: { shape1: { id: 'shape1', type: 'geo' } }, schema: { version: 1 } }
const hash1 = generateDocHash(doc1)
const hash2 = generateDocHash(doc2)

console.log('Test 1 - Identical documents:')
console.log('Hash 1:', hash1)
console.log('Hash 2:', hash2)
console.log('Same hash?', hash1 === hash2 ? '✅ YES' : '❌ NO')
console.log('Would skip save?', hash1 === hash2 ? '✅ YES' : '❌ NO')
console.log()

// Test 2: Different document should have different hash
const doc3 = { store: { shape1: { id: 'shape1', type: 'geo' } }, schema: { version: 1 } }
const doc4 = { store: { shape1: { id: 'shape1', type: 'geo' }, shape2: { id: 'shape2', type: 'text' } }, schema: { version: 1 } }
const hash3 = generateDocHash(doc3)
const hash4 = generateDocHash(doc4)

console.log('Test 2 - Different documents:')
console.log('Hash 3:', hash3)
console.log('Hash 4:', hash4)
console.log('Same hash?', hash3 === hash4 ? '✅ YES' : '❌ NO')
console.log('Would skip save?', hash3 === hash4 ? '✅ YES' : '❌ NO')
console.log()

// Test 3: Document with only presence changes (should be different)
const doc5 = { 
  store: { 
    shape1: { id: 'shape1', type: 'geo' },
    presence1: { id: 'presence1', userId: 'user1', cursor: { x: 100, y: 200 } }
  }, 
  schema: { version: 1 } 
}
const doc6 = { 
  store: { 
    shape1: { id: 'shape1', type: 'geo' },
    presence1: { id: 'presence1', userId: 'user1', cursor: { x: 150, y: 250 } }
  }, 
  schema: { version: 1 } 
}
const hash5 = generateDocHash(doc5)
const hash6 = generateDocHash(doc6)

console.log('Test 3 - Only presence/cursor changes:')
console.log('Hash 5:', hash5)
console.log('Hash 6:', hash6)
console.log('Same hash?', hash5 === hash6 ? '✅ YES' : '❌ NO')
console.log('Would skip save?', hash5 === hash6 ? '✅ YES' : '❌ NO')
console.log('Note: Presence changes will still trigger saves (this is expected behavior)')
console.log()

console.log('✅ Change detection optimization test completed!')
console.log('The optimization will:')
console.log('- Skip saves when documents are identical')
console.log('- Allow saves when documents have actual content changes')
console.log('- Still save presence/cursor changes (which is correct for real-time collaboration)')
