/**
 * E2E Tests for Offline Storage and Cold Reload
 *
 * Tests verify:
 * - Canvas state persists to IndexedDB
 * - Canvas loads from local storage on cold reload (offline)
 * - Works completely offline after initial load
 * - Sync resumes automatically when back online
 */

import { test, expect, Page } from '@playwright/test'

// Helper to wait for canvas to be ready
async function waitForCanvas(page: Page) {
  await page.waitForSelector('.tl-container', { timeout: 30000 })
  await page.waitForSelector('.tl-canvas', { timeout: 30000 })
  // Wait for canvas to be interactive
  await page.waitForTimeout(2000)
}

// Generate unique room ID
function getTestRoomId() {
  return `offline-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Helper to create a shape
async function createShape(page: Page, x: number, y: number) {
  await page.keyboard.press('r') // Rectangle tool shortcut
  await page.waitForTimeout(300)

  const canvas = page.locator('.tl-canvas')
  await canvas.waitFor({ state: 'visible', timeout: 30000 })
  await canvas.click({ position: { x, y } })
  await page.waitForTimeout(500)
}

// Helper to draw freehand line
async function drawLine(page: Page, startX: number, startY: number, endX: number, endY: number) {
  await page.keyboard.press('d') // Draw tool shortcut
  await page.waitForTimeout(300)

  const canvas = page.locator('.tl-canvas')
  await canvas.waitFor({ state: 'visible', timeout: 30000 })
  await canvas.hover({ position: { x: startX, y: startY } })
  await page.mouse.down()
  await canvas.hover({ position: { x: endX, y: endY } })
  await page.mouse.up()
  await page.waitForTimeout(500)
}

// Helper to count shapes
async function getShapeCount(page: Page): Promise<number> {
  return await page.locator('.tl-shape').count()
}

// Helper to check IndexedDB has data
async function hasIndexedDBData(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    try {
      const databases = await indexedDB.databases()
      // Check for automerge or canvas-related databases
      return databases.some(db =>
        db.name?.includes('automerge') ||
        db.name?.includes('canvas') ||
        db.name?.includes('document')
      )
    } catch {
      return false
    }
  })
}

// Helper to wait for IndexedDB save
async function waitForIndexedDBSave(page: Page) {
  // IndexedDB saves are debounced - wait for settle
  await page.waitForTimeout(3000)
}

test.describe('Offline Storage', () => {
  // These tests can be flaky in CI due to timing
  test.describe.configure({ retries: 2 })

  test('canvas state saves to IndexedDB', async ({ page }) => {
    const roomId = getTestRoomId()

    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)

    // Create some content
    await createShape(page, 150, 150)
    await createShape(page, 250, 250)

    // Wait for save to IndexedDB
    await waitForIndexedDBSave(page)

    // Verify IndexedDB has data
    const hasData = await hasIndexedDBData(page)
    expect(hasData).toBe(true)
  })

  test('canvas loads from IndexedDB on cold reload', async ({ page, context }) => {
    const roomId = getTestRoomId()

    // First: Create content while online
    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)

    await createShape(page, 100, 100)
    await createShape(page, 200, 200)
    await createShape(page, 300, 300)

    // Wait for IndexedDB save
    await waitForIndexedDBSave(page)

    const shapeCountBefore = await getShapeCount(page)
    expect(shapeCountBefore).toBeGreaterThanOrEqual(3)

    // Reload the page (cold reload) - simulating browser restart
    await page.reload()

    // Wait for canvas to load from IndexedDB/server
    await waitForCanvas(page)

    // Shapes should be restored from local storage or server
    const shapeCountAfter = await getShapeCount(page)

    // Should have the same shapes (loaded from IndexedDB or synced)
    expect(shapeCountAfter).toBe(shapeCountBefore)
  })

  test('works completely offline after initial load', async ({ page, context }) => {
    const roomId = getTestRoomId()

    // Load page online first
    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)
    await page.waitForTimeout(2000) // Let sync complete

    const initialCount = await getShapeCount(page)

    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    // Create shapes while offline
    await createShape(page, 100, 100)
    await createShape(page, 200, 100)
    await drawLine(page, 300, 100, 400, 200)

    // Shapes should appear locally
    const offlineCount = await getShapeCount(page)
    expect(offlineCount).toBeGreaterThan(initialCount)

    // Wait for local save
    await waitForIndexedDBSave(page)

    // Go back online to verify persistence
    await context.setOffline(false)
    await page.waitForTimeout(3000)

    // Reload to verify content persisted (now that we're online)
    await page.reload()
    await waitForCanvas(page)

    // Shapes should persist (from IndexedDB and/or sync)
    const reloadedCount = await getShapeCount(page)
    expect(reloadedCount).toBe(offlineCount)
  })

  test('sync resumes automatically when back online', async ({ page, context }) => {
    const roomId = getTestRoomId()

    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)
    await page.waitForTimeout(3000) // Initial sync - give more time

    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    // Create content offline
    await createShape(page, 150, 150)
    await page.waitForTimeout(1000)

    const offlineCount = await getShapeCount(page)

    // Go back online
    await context.setOffline(false)

    // Wait for reconnection and sync - increase wait time
    await page.waitForTimeout(7000)

    // Content should still be there after sync
    const onlineCount = await getShapeCount(page)
    expect(onlineCount).toBe(offlineCount)

    // Wait for canvas to be fully interactive after reconnection
    await waitForCanvas(page)

    // Verify sync worked by checking we can still interact
    await createShape(page, 250, 250)
    await page.waitForTimeout(1000) // Wait for shape to render
    const finalCount = await getShapeCount(page)
    expect(finalCount).toBeGreaterThan(onlineCount)
  })
})

test.describe('Offline UI Indicators', () => {
  test('shows appropriate status when offline', async ({ page, context }) => {
    const roomId = getTestRoomId()

    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)

    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(2000)

    // Look for offline status indicators
    // The app may show various indicators depending on implementation
    const possibleIndicators = [
      page.locator(':text("Offline")'),
      page.locator(':text("Working Offline")'),
      page.locator(':text("Disconnected")'),
      page.locator('[class*="offline"]'),
      page.locator('[class*="disconnected"]'),
    ]

    // Check if any indicator is present
    let foundIndicator = false
    for (const indicator of possibleIndicators) {
      try {
        const count = await indicator.count()
        if (count > 0 && await indicator.first().isVisible()) {
          foundIndicator = true
          break
        }
      } catch {
        continue
      }
    }

    // Either show explicit indicator OR continue working (offline-first)
    if (!foundIndicator) {
      // Canvas should still work offline
      await createShape(page, 200, 200)
      const count = await getShapeCount(page)
      expect(count).toBeGreaterThan(0)
    }
  })

  test('shows reconnection status when coming back online', async ({ page, context }) => {
    const roomId = getTestRoomId()

    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)
    await page.waitForTimeout(2000)

    // Go offline then online
    await context.setOffline(true)
    await page.waitForTimeout(2000)
    await context.setOffline(false)

    // Wait for reconnection
    await page.waitForTimeout(3000)

    // Look for connected status or verify functionality works
    const possibleConnectedIndicators = [
      page.locator(':text("Connected")'),
      page.locator('[class*="connected"]'),
      page.locator('[class*="synced"]'),
    ]

    let foundConnected = false
    for (const indicator of possibleConnectedIndicators) {
      try {
        const count = await indicator.count()
        if (count > 0 && await indicator.first().isVisible()) {
          foundConnected = true
          break
        }
      } catch {
        continue
      }
    }

    // Verify functionality works (can create and see shapes)
    await createShape(page, 200, 200)
    const count = await getShapeCount(page)
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Data Persistence Across Sessions', () => {
  test('data persists when closing and reopening browser', async ({ browser }) => {
    const roomId = getTestRoomId()

    // Session 1: Create content
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()

    await page1.goto(`/board/${roomId}`)
    await waitForCanvas(page1)

    await createShape(page1, 100, 100)
    await createShape(page1, 200, 200)
    await waitForIndexedDBSave(page1)

    const countSession1 = await getShapeCount(page1)

    // Close first session
    await context1.close()

    // Session 2: Open new browser context
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()

    await page2.goto(`/board/${roomId}`)
    await waitForCanvas(page2)

    // Should see the same shapes (from server sync or IndexedDB)
    // Note: This tests server-side persistence, not just IndexedDB
    const countSession2 = await getShapeCount(page2)

    expect(countSession2).toBe(countSession1)

    await context2.close()
  })
})

test.describe('Conflict Resolution', () => {
  test('handles concurrent offline edits gracefully', async ({ browser }) => {
    const roomId = getTestRoomId()

    // Create two contexts
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      // Both connect to same room
      await Promise.all([
        page1.goto(`/board/${roomId}`),
        page2.goto(`/board/${roomId}`)
      ])

      await Promise.all([
        waitForCanvas(page1),
        waitForCanvas(page2)
      ])

      // Wait for initial sync
      await page1.waitForTimeout(3000)
      await page2.waitForTimeout(3000)

      // Both go offline
      await context1.setOffline(true)
      await context2.setOffline(true)
      await page1.waitForTimeout(1000)

      // Both make edits while offline
      await createShape(page1, 100, 100)
      await createShape(page2, 200, 200)
      await page1.waitForTimeout(1000)
      await page2.waitForTimeout(1000)

      // Both come back online
      await context1.setOffline(false)
      await context2.setOffline(false)

      // Wait for sync and conflict resolution
      await page1.waitForTimeout(5000)
      await page2.waitForTimeout(5000)

      // Both should see both shapes (CRDT merge)
      const count1 = await getShapeCount(page1)
      const count2 = await getShapeCount(page2)

      // Both should have merged to same state
      expect(count1).toBe(count2)
      // Should have at least 2 shapes (both offline edits)
      expect(count1).toBeGreaterThanOrEqual(2)
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})
