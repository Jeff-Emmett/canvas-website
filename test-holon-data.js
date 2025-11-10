// Test script for holon data loading with ID 1002848305066
import { holosphereService } from './src/lib/HoloSphereService'

const HOLON_ID = '1002848305066'

async function testHolonDataLoading() {
  console.log('🧪 Testing Holon Data Loading')
  console.log('================================')
  console.log(`Testing with Holon ID: ${HOLON_ID}`)
  console.log('')

  try {
    // Initialize the service
    const isInitialized = await holosphereService.initialize()
    console.log('✅ HoloSphere initialized:', isInitialized)

    if (!isInitialized) {
      console.log('❌ HoloSphere not initialized, cannot proceed')
      return
    }

    // List of lenses to check
    const lensesToCheck = [
      'active_users',
      'users',
      'rankings',
      'stats',
      'tasks',
      'progress',
      'events',
      'activities',
      'items',
      'shopping',
      'active_items',
      'proposals',
      'offers',
      'requests',
      'checklists',
      'roles'
    ]

    console.log(`\n📂 Checking ${lensesToCheck.length} data categories...\n`)

    const allData = {}

    for (const lens of lensesToCheck) {
      console.log(`\n📂 Checking lens: ${lens}`)
      console.log('----------------------------')

      try {
        // Test the new getDataWithWait method
        const startTime = Date.now()
        const lensData = await holosphereService.getDataWithWait(HOLON_ID, lens, 2000)
        const duration = Date.now() - startTime

        if (lensData && Object.keys(lensData).length > 0) {
          console.log(`✅ Found data in ${lens} (${duration}ms)`)
          console.log(`   Keys: ${Object.keys(lensData).length}`)
          console.log(`   Sample keys: ${Object.keys(lensData).slice(0, 5).join(', ')}`)
          allData[lens] = lensData
        } else {
          console.log(`⚠️  No data found in ${lens} (${duration}ms)`)
        }
      } catch (err) {
        console.log(`❌ Error loading ${lens}:`, err.message)
      }
    }

    console.log('\n\n📊 SUMMARY')
    console.log('================================')
    console.log(`Total categories with data: ${Object.keys(allData).length}`)

    if (Object.keys(allData).length > 0) {
      console.log('\n✅ Categories with data:')
      for (const [lens, data] of Object.entries(allData)) {
        console.log(`   - ${lens}: ${Object.keys(data).length} entries`)
      }

      console.log('\n📄 Sample data from first category:')
      const firstLens = Object.keys(allData)[0]
      const firstData = allData[firstLens]
      const firstKey = Object.keys(firstData)[0]
      console.log(`   Lens: ${firstLens}`)
      console.log(`   Key: ${firstKey}`)
      console.log(`   Value:`, JSON.stringify(firstData[firstKey], null, 2).substring(0, 200))
    } else {
      console.log('\n⚠️  No data found in any category')
      console.log('   This could mean:')
      console.log('   1. The holon ID has no data stored yet')
      console.log('   2. The Gun network is not accessible')
      console.log('   3. The data is stored under different lens names')
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
  }
}

// Run the test
testHolonDataLoading().then(() => {
  console.log('\n🏁 Test complete')
  process.exit(0)
}).catch(err => {
  console.error('❌ Test crashed:', err)
  process.exit(1)
})
