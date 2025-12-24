// Simple test to verify Holon functionality
import { holosphereService } from './HoloSphereService'

export async function testHolonFunctionality() {
  
  try {
    // Test initialization
    const isInitialized = await holosphereService.initialize()
    
    if (!isInitialized) {
      return false
    }
    
    // Test getting a holon
    const holonId = await holosphereService.getHolon(40.7128, -74.0060, 7)
    
    if (holonId) {
      // Test storing data
      const testData = {
        id: 'test-1',
        content: 'Hello from Holon!',
        timestamp: Date.now()
      }
      
      const storeSuccess = await holosphereService.putData(holonId, 'test', testData)
      
      // Test retrieving data
      const retrievedData = await holosphereService.getData(holonId, 'test')
      
      // Test getting hierarchy
      const hierarchy = holosphereService.getHolonHierarchy(holonId)
      
      // Test getting scalespace
      const scalespace = holosphereService.getHolonScalespace(holonId)
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Holon test failed:', error)
    return false
  }
}

// Auto-run test when imported
if (typeof window !== 'undefined') {
  testHolonFunctionality()
}
