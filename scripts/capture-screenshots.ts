import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

async function captureScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173');

  // Wait for the app to fully load - look for the canvas element
  console.log('Waiting for app to load...');
  await page.waitForSelector('canvas', { timeout: 30000 });

  // Give time for satellites and orbits to render
  await page.waitForTimeout(3000);

  // 1. Full app screenshot
  console.log('Capturing full app screenshot...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'full-app.png'),
    fullPage: false,
  });

  // 2. Globe area (left side)
  console.log('Capturing globe view...');
  const globeArea = page.locator('.flex-1').first();
  if (await globeArea.isVisible()) {
    await globeArea.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'globe-view.png'),
    });
  }

  // 3. Conjunction list panel
  console.log('Capturing conjunction list...');
  const conjunctionPanel = page.locator('text=Conjunctions').locator('..');
  if (await conjunctionPanel.isVisible().catch(() => false)) {
    // Find the parent panel containing conjunctions
    const panel = page.locator('[class*="overflow-y-auto"]').filter({ hasText: 'Conjunctions' }).first();
    if (await panel.isVisible().catch(() => false)) {
      await panel.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'conjunction-list.png'),
      });
    }
  }

  // 4. Distance timeline graph
  console.log('Capturing distance timeline...');
  // The timeline is in the controls area
  const timelineArea = page.locator('svg').filter({ has: page.locator('path[stroke="#22c55e"]') }).first();
  if (await timelineArea.isVisible().catch(() => false)) {
    await timelineArea.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'distance-timeline.png'),
    });
  }

  // 5. Try to click expand button for fullscreen graph
  console.log('Capturing fullscreen distance graph...');
  const expandButton = page.locator('button[title="Expand to fullscreen"]');
  if (await expandButton.isVisible().catch(() => false)) {
    await expandButton.click();
    await page.waitForTimeout(1500);

    // Capture the fullscreen modal
    const modal = page.locator('.fixed.inset-0').first();
    if (await modal.isVisible().catch(() => false)) {
      await modal.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'fullscreen-graph.png'),
      });
    }

    // Close modal with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 6. Relative View panel (A→B)
  console.log('Capturing relative view panel...');
  const relativeViewPanel = page.locator('text=A → B').locator('..').locator('..');
  if (await relativeViewPanel.isVisible().catch(() => false)) {
    await relativeViewPanel.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'relative-view.png'),
    });
  }

  // 7. Orbital Parameters panel
  console.log('Capturing orbital parameters...');
  const orbitalParamsPanel = page.locator('text=Orbital Parameters').locator('..').locator('..');
  if (await orbitalParamsPanel.isVisible().catch(() => false)) {
    await orbitalParamsPanel.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'orbital-parameters.png'),
    });
  }

  // 8. Controls area (right sidebar)
  console.log('Capturing controls sidebar...');
  const controlsArea = page.locator('.w-96').first();
  if (await controlsArea.isVisible().catch(() => false)) {
    await controlsArea.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'controls-sidebar.png'),
    });
  }

  await browser.close();
  console.log('Screenshots captured successfully!');
}

captureScreenshots().catch(console.error);
