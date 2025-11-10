/**
 * Test script for data conversion edge cases
 * This script tests the conversion logic with various malformed data scenarios
 */

// Mock the conversion functions to test them
// In a real scenario, these would be imported from AutomergeDurableObject

interface ConversionStats {
  total: number
  converted: number
  skipped: number
  errors: number
  errorDetails: string[]
}

// Test cases for edge cases
const testCases = {
  // Test case 1: Missing state.id
  missingStateId: {
    documents: [
      { state: { typeName: 'shape', x: 0, y: 0 } }, // Missing id
      { state: { id: 'shape:test1', typeName: 'shape', x: 0, y: 0 } } // Valid
    ]
  },
  
  // Test case 2: Missing state.typeName
  missingTypeName: {
    documents: [
      { state: { id: 'shape:test2', x: 0, y: 0 } }, // Missing typeName
      { state: { id: 'shape:test3', typeName: 'shape', x: 0, y: 0 } } // Valid
    ]
  },
  
  // Test case 3: Null/undefined records
  nullRecords: {
    documents: [
      null,
      undefined,
      { state: { id: 'shape:test4', typeName: 'shape', x: 0, y: 0 } }
    ]
  },
  
  // Test case 4: Missing state property
  missingState: {
    documents: [
      { id: 'shape:test5' }, // Missing state
      { state: { id: 'shape:test6', typeName: 'shape', x: 0, y: 0 } } // Valid
    ]
  },
  
  // Test case 5: Invalid ID type
  invalidIdType: {
    documents: [
      { state: { id: 12345, typeName: 'shape', x: 0, y: 0 } }, // ID is number, not string
      { state: { id: 'shape:test7', typeName: 'shape', x: 0, y: 0 } } // Valid
    ]
  },
  
  // Test case 6: Custom records (obsidian_vault)
  customRecords: {
    documents: [
      { state: { id: 'obsidian_vault:test', typeName: 'obsidian_vault', data: {} } },
      { state: { id: 'shape:test8', typeName: 'shape', x: 0, y: 0 } }
    ]
  },
  
  // Test case 7: Malformed shapes (missing required properties)
  malformedShapes: {
    documents: [
      { state: { id: 'shape:test9', typeName: 'shape' } }, // Missing x, y
      { state: { id: 'shape:test10', typeName: 'shape', x: 0 } }, // Missing y
      { state: { id: 'shape:test11', typeName: 'shape', x: 0, y: 0, type: 'geo', w: 100, h: 100 } } // w/h at top level
    ]
  },
  
  // Test case 8: Empty documents array
  emptyDocuments: {
    documents: []
  },
  
  // Test case 9: Mixed valid and invalid
  mixedValidInvalid: {
    documents: [
      { state: { id: 'shape:valid1', typeName: 'shape', x: 0, y: 0 } },
      null,
      { state: { id: 'shape:valid2', typeName: 'shape', x: 10, y: 20 } },
      { state: { typeName: 'shape' } }, // Missing id
      { state: { id: 'shape:valid3', typeName: 'shape', x: 30, y: 40 } }
    ]
  }
}

// Expected results for validation
const expectedResults = {
  missingStateId: {
    converted: 1,
    skipped: 1,
    errors: 0
  },
  missingTypeName: {
    converted: 1,
    skipped: 1,
    errors: 0
  },
  nullRecords: {
    converted: 1,
    skipped: 2,
    errors: 0
  },
  missingState: {
    converted: 1,
    skipped: 1,
    errors: 0
  },
  invalidIdType: {
    converted: 1,
    skipped: 1,
    errors: 0
  },
  customRecords: {
    converted: 2, // Both should be converted
    skipped: 0,
    errors: 0,
    customRecordCount: 1
  },
  malformedShapes: {
    converted: 3, // All should be converted (shape migration will fix them)
    skipped: 0,
    errors: 0
  },
  emptyDocuments: {
    converted: 0,
    skipped: 0,
    errors: 0
  },
  mixedValidInvalid: {
    converted: 3,
    skipped: 2,
    errors: 0
  }
}

// Simulate the migration function (simplified version)
function simulateMigrateDocumentsToStore(oldDoc: any): { store: any, stats: ConversionStats } {
  const newDoc = {
    store: {},
    schema: { version: 1, recordVersions: {} }
  }
  
  const stats: ConversionStats = {
    total: 0,
    converted: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  }
  
  if (oldDoc.documents && Array.isArray(oldDoc.documents)) {
    stats.total = oldDoc.documents.length
    
    oldDoc.documents.forEach((doc: any, index: number) => {
      try {
        if (!doc) {
          stats.skipped++
          stats.errorDetails.push(`Document at index ${index} is null or undefined`)
          return
        }
        
        if (!doc.state) {
          stats.skipped++
          stats.errorDetails.push(`Document at index ${index} missing state property`)
          return
        }
        
        if (!doc.state.id) {
          stats.skipped++
          stats.errorDetails.push(`Document at index ${index} missing state.id`)
          return
        }
        
        if (!doc.state.typeName) {
          stats.skipped++
          stats.errorDetails.push(`Document at index ${index} missing state.typeName (id: ${doc.state.id})`)
          return
        }
        
        if (typeof doc.state.id !== 'string') {
          stats.skipped++
          stats.errorDetails.push(`Document at index ${index} has invalid state.id type: ${typeof doc.state.id}`)
          return
        }
        
        (newDoc.store as any)[doc.state.id] = doc.state
        stats.converted++
      } catch (error) {
        stats.errors++
        const errorMsg = `Error migrating document at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        stats.errorDetails.push(errorMsg)
      }
    })
  }
  
  return { store: newDoc.store, stats }
}

// Run tests
console.log('🧪 Testing data conversion edge cases...\n')

let passedTests = 0
let failedTests = 0

for (const [testName, testCase] of Object.entries(testCases)) {
  console.log(`\n📋 Test: ${testName}`)
  const result = simulateMigrateDocumentsToStore(testCase)
  const expected = expectedResults[testName as keyof typeof expectedResults]
  
  if (expected) {
    const passed = 
      result.stats.converted === expected.converted &&
      result.stats.skipped === expected.skipped &&
      result.stats.errors === expected.errors
    
    if (passed) {
      console.log(`✅ PASSED`)
      passedTests++
    } else {
      console.log(`❌ FAILED`)
      console.log(`   Expected: converted=${expected.converted}, skipped=${expected.skipped}, errors=${expected.errors}`)
      console.log(`   Got: converted=${result.stats.converted}, skipped=${result.stats.skipped}, errors=${result.stats.errors}`)
      failedTests++
    }
    
    // Check custom records if expected
    if (expected.customRecordCount !== undefined) {
      const customRecords = Object.values(result.store).filter((r: any) => 
        r.id && typeof r.id === 'string' && r.id.startsWith('obsidian_vault:')
      )
      if (customRecords.length === expected.customRecordCount) {
        console.log(`✅ Custom records check passed: ${customRecords.length}`)
      } else {
        console.log(`❌ Custom records check failed: expected ${expected.customRecordCount}, got ${customRecords.length}`)
        failedTests++
      }
    }
    
    if (result.stats.errorDetails.length > 0) {
      console.log(`   Warnings: ${result.stats.errorDetails.length} (showing first 3)`)
      result.stats.errorDetails.slice(0, 3).forEach((detail, i) => {
        console.log(`     ${i + 1}. ${detail}`)
      })
    }
  } else {
    console.log(`⚠️  No expected results defined for this test`)
  }
}

console.log(`\n📊 Test Summary:`)
console.log(`   ✅ Passed: ${passedTests}`)
console.log(`   ❌ Failed: ${failedTests}`)
console.log(`   📈 Total: ${passedTests + failedTests}`)

if (failedTests === 0) {
  console.log(`\n🎉 All tests passed!`)
  process.exit(0)
} else {
  console.log(`\n⚠️  Some tests failed. Review the output above.`)
  process.exit(1)
}
