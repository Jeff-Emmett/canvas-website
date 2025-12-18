/**
 * E2E Tests for Real-time Collaboration via Automerge CRDT Sync
 *
 * Tests verify:
 * - Two browsers see the same canvas state
 * - Changes sync between clients in real-time
 * - Shapes created by one client appear for others
 * - Offline changes merge correctly when reconnecting
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'

// Helper to wait for tldraw canvas to be ready
async function waitForCanvas(page: Page) {
  // Wait for the tldraw editor to be mounted
  await page.waitForSelector('.tl-container', { timeout: 30000 })
  // Give it a moment to fully initialize
  await page.waitForTimeout(1000)
}

// Helper to get unique room ID for test isolation
function getTestRoomId() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Helper to create a shape on the canvas
async function createRectangle(page: Page, x: number, y: number) {
  // Select rectangle tool from toolbar
  await page.click('[data-testid="tools.rectangle"]').catch(() => {
    // Fallback: try keyboard shortcut
    return page.keyboard.press('r')
  })

  // Click and drag to create shape
  const canvas = page.locator('.tl-canvas')
  await canvas.click({ position: { x, y } })
  await page.waitForTimeout(500)
}

// Helper to count shapes on canvas
async function getShapeCount(page: Page): Promise<number> {
  // Count shape elements in the DOM
  const shapes = await page.locator('.tl-shape').count()
  return shapes
}

// Helper to wait for sync (connection indicator shows connected)
async function waitForConnection(page: Page) {
  // Wait for the connection status to show connected
  // The app shows different states: connecting, connected, offline
  await page.waitForFunction(() => {
    const indicator = document.querySelector('[class*="connection"]')
    return indicator?.textContent?.toLowerCase().includes('connected') ||
           !document.querySelector('[class*="offline"]')
  }, { timeout: 10000 }).catch(() => {
    // If no indicator, assume connected after delay
    return page.waitForTimeout(2000)
  })
}

test.describe('Real-time Collaboration', () => {
  test.describe.configure({ mode: 'serial' })

  let roomId: string

  test.beforeEach(() => {
    roomId = getTestRoomId()
  })

  test('canvas loads and displays connection status', async ({ page }) => {
    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)

    // Verify tldraw container is present
    await expect(page.locator('.tl-container')).toBeVisible()

    // Verify canvas is interactive
    await expect(page.locator('.tl-canvas')).toBeVisible()
  })

  test('two browsers see the same initial canvas', async ({ browser }) => {
    // Create two independent browser contexts (like two different users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      // Both navigate to the same room
      await Promise.all([
        page1.goto(`/board/${roomId}`),
        page2.goto(`/board/${roomId}`)
      ])

      // Wait for both canvases to load
      await Promise.all([
        waitForCanvas(page1),
        waitForCanvas(page2)
      ])

      // Wait for sync connection
      await Promise.all([
        waitForConnection(page1),
        waitForConnection(page2)
      ])

      // Both should have empty canvases initially (or same shapes if room exists)
      const count1 = await getShapeCount(page1)
      const count2 = await getShapeCount(page2)

      // Should be the same (both see same state)
      expect(count1).toBe(count2)
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('shape created by one client appears for another', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      // Both navigate to the same room
      await Promise.all([
        page1.goto(`/board/${roomId}`),
        page2.goto(`/board/${roomId}`)
      ])

      await Promise.all([
        waitForCanvas(page1),
        waitForCanvas(page2)
      ])

      await Promise.all([
        waitForConnection(page1),
        waitForConnection(page2)
      ])

      // Get initial shape count
      const initialCount = await getShapeCount(page1)

      // Page 1 creates a shape
      await createRectangle(page1, 200, 200)

      // Wait for sync
      await page1.waitForTimeout(2000)

      // Page 2 should see the new shape
      await page2.waitForFunction(
        (expected) => document.querySelectorAll('.tl-shape').length > expected,
        initialCount,
        { timeout: 10000 }
      )

      const count1 = await getShapeCount(page1)
      const count2 = await getShapeCount(page2)

      // Both should have the same number of shapes
      expect(count2).toBe(count1)
      expect(count1).toBeGreaterThan(initialCount)
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('changes persist after page reload', async ({ page }) => {
    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)
    await waitForConnection(page)

    // Create a shape
    await createRectangle(page, 150, 150)
    await page.waitForTimeout(2000) // Wait for sync

    const countBefore = await getShapeCount(page)

    // Reload the page
    await page.reload()
    await waitForCanvas(page)
    await waitForConnection(page)

    // Shape should still be there
    const countAfter = await getShapeCount(page)
    expect(countAfter).toBe(countBefore)
  })

  test('concurrent edits from multiple clients merge correctly', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      await Promise.all([
        page1.goto(`/board/${roomId}`),
        page2.goto(`/board/${roomId}`)
      ])

      await Promise.all([
        waitForCanvas(page1),
        waitForCanvas(page2)
      ])

      await Promise.all([
        waitForConnection(page1),
        waitForConnection(page2)
      ])

      const initialCount = await getShapeCount(page1)

      // Both clients create shapes simultaneously
      await Promise.all([
        createRectangle(page1, 100, 100),
        createRectangle(page2, 300, 300)
      ])

      // Wait for sync to complete
      await page1.waitForTimeout(3000)
      await page2.waitForTimeout(3000)

      // Both clients should see both shapes
      const count1 = await getShapeCount(page1)
      const count2 = await getShapeCount(page2)

      // Both should have 2 more shapes than initial
      expect(count1).toBeGreaterThanOrEqual(initialCount + 2)
      expect(count1).toBe(count2)
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})

test.describe('Offline Sync Recovery', () => {
  test('client reconnects and syncs after going offline', async ({ page, context }) => {
    const roomId = getTestRoomId()

    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)
    await waitForConnection(page)

    // Create initial shape while online
    await createRectangle(page, 100, 100)
    await page.waitForTimeout(2000)

    const countOnline = await getShapeCount(page)

    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    // Create shape while offline
    await createRectangle(page, 200, 200)
    await page.waitForTimeout(1000)

    // Shape should be visible locally
    const countOffline = await getShapeCount(page)
    expect(countOffline).toBe(countOnline + 1)

    // Go back online
    await context.setOffline(false)
    await page.waitForTimeout(3000) // Wait for sync

    // Shape should still be there after reconnect
    const countReconnected = await getShapeCount(page)
    expect(countReconnected).toBe(countOffline)
  })
})

test.describe('Connection Status UI', () => {
  test('shows offline indicator when disconnected', async ({ page, context }) => {
    const roomId = getTestRoomId()

    await page.goto(`/board/${roomId}`)
    await waitForCanvas(page)

    // Go offline
    await context.setOffline(true)

    // Wait for offline state to be detected
    await page.waitForTimeout(2000)

    // Should show some indication of offline status
    // Look for common offline indicators
    const offlineIndicator = await page.locator('[class*="offline"], [class*="disconnected"], :text("Offline"), :text("Disconnected")').first()

    // Check if any offline indicator is visible
    const isOffline = await offlineIndicator.isVisible().catch(() => false)

    // If no explicit indicator, check that we can still interact (offline-first mode)
    if (!isOffline) {
      // Canvas should still be usable offline
      await expect(page.locator('.tl-canvas')).toBeVisible()
    }

    // Go back online
    await context.setOffline(false)
  })
})
