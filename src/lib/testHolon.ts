// Simple test to verify Holon functionality
import { holosphereService } from './HoloSphereService'

export async function testHolonFunctionality() {
  console.log('🧪 Testing Holon functionality...')
  
  try {
    // Test initialization
    const isInitialized = await holosphereService.initialize()
    console.log('✅ HoloSphere initialized:', isInitialized)
    
    if (!isInitialized) {
      console.log('❌ HoloSphere not initialized, skipping tests')
      return false
    }
    
    // Test getting a holon
    const holonId = await holosphereService.getHolon(40.7128, -74.0060, 7)
    console.log('✅ Got holon ID:', holonId)
    
    if (holonId) {
      // Test storing data
      const testData = {
        id: 'test-1',
        content: 'Hello from Holon!',
        timestamp: Date.now()
      }
      
      const storeSuccess = await holosphereService.putData(holonId, 'test', testData)
      console.log('✅ Stored data:', storeSuccess)
      
      // Test retrieving data
      const retrievedData = await holosphereService.getData(holonId, 'test')
      console.log('✅ Retrieved data:', retrievedData)
      
      // Test getting hierarchy
      const hierarchy = holosphereService.getHolonHierarchy(holonId)
      console.log('✅ Holon hierarchy:', hierarchy)
      
      // Test getting scalespace
      const scalespace = holosphereService.getHolonScalespace(holonId)
      console.log('✅ Holon scalespace:', scalespace)
    }
    
    console.log('✅ All Holon tests passed!')
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
