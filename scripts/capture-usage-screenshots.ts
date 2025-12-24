import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

async function captureUsageScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173');

  // Wait for the app to fully load
  console.log('Waiting for app to load...');
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);

  // 1. Full app screenshot
  console.log('1. Capturing full app...');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'full-app.png') });

  // 2. Left sidebar (scroll to top first)
  console.log('2. Capturing left sidebar...');
  const sidebar = page.locator('.w-\\[20rem\\]').first();
  await sidebar.evaluate(el => el.scrollTop = 0);
  await page.waitForTimeout(300);
  await sidebar.screenshot({ path: path.join(SCREENSHOTS_DIR, 'left-sidebar.png') });

  // 3. Satellite selection area (top of sidebar)
  console.log('3. Capturing satellite selection...');
  // Take a cropped screenshot of just the top portion
  const sidebarBox = await sidebar.boundingBox();
  if (sidebarBox) {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'satellite-selection.png'),
      clip: { x: sidebarBox.x, y: sidebarBox.y, width: sidebarBox.width, height: 420 }
    });
  }

  // 4. Timeline controls area
  console.log('4. Capturing timeline controls...');
  if (sidebarBox) {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'timeline-controls.png'),
      clip: { x: sidebarBox.x, y: sidebarBox.y + 380, width: sidebarBox.width, height: 200 }
    });
  }

  // 5. Scroll down to see Orbital Parameters
  console.log('5. Capturing orbital parameters...');
  await sidebar.evaluate(el => el.scrollTop = 300);
  await page.waitForTimeout(300);
  if (sidebarBox) {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'orbital-parameters.png'),
      clip: { x: sidebarBox.x, y: sidebarBox.y + 200, width: sidebarBox.width, height: 380 }
    });
  }

  // 6. Scroll to Close Approaches
  console.log('6. Capturing close approaches...');
  await sidebar.evaluate(el => el.scrollTop = 600);
  await page.waitForTimeout(300);
  if (sidebarBox) {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'close-approaches.png'),
      clip: { x: sidebarBox.x, y: sidebarBox.y + 100, width: sidebarBox.width, height: 450 }
    });
  }

  // Reset scroll
  await sidebar.evaluate(el => el.scrollTop = 0);
  await page.waitForTimeout(200);

  // 7. Main 3D view
  console.log('7. Capturing main 3D view...');
  const mainViewBox = await page.locator('.flex-1.relative').first().boundingBox();
  if (mainViewBox) {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'main-3d-view.png'),
      clip: { x: mainViewBox.x, y: mainViewBox.y, width: mainViewBox.width * 0.65, height: mainViewBox.height * 0.7 }
    });
  }

  // 8. View controls (checkbox bar at bottom of 3D view)
  console.log('8. Capturing view controls...');
  const viewControlsBar = page.locator('.backdrop-blur-sm').first();
  if (await viewControlsBar.isVisible().catch(() => false)) {
    await viewControlsBar.screenshot({ path: path.join(SCREENSHOTS_DIR, 'view-controls.png') });
  }

  // 9. A→B View panel
  console.log('9. Capturing A→B view panel...');
  const abViewPanel = page.locator('.bg-gray-900.border.border-gray-700.rounded-lg').first();
  if (await abViewPanel.isVisible().catch(() => false)) {
    await abViewPanel.screenshot({ path: path.join(SCREENSHOTS_DIR, 'ab-view-panel.png') });
  }

  // 10. Bottom panel with distance graph
  console.log('10. Capturing bottom panel...');
  const bottomPanel = page.locator('.col-span-2').first();
  if (await bottomPanel.isVisible().catch(() => false)) {
    await bottomPanel.screenshot({ path: path.join(SCREENSHOTS_DIR, 'bottom-panel.png') });
  }

  // 11. Click SMA tab
  console.log('11. Capturing SMA tab...');
  const smaTab = page.locator('button:has-text("SMA")');
  if (await smaTab.isVisible().catch(() => false)) {
    await smaTab.click();
    await page.waitForTimeout(500);
    await bottomPanel.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sma-tab.png') });
  }

  // 12. Click Period tab
  console.log('12. Capturing Period tab...');
  const periodTab = page.locator('button:has-text("Period")');
  if (await periodTab.isVisible().catch(() => false)) {
    await periodTab.click();
    await page.waitForTimeout(500);
    await bottomPanel.screenshot({ path: path.join(SCREENSHOTS_DIR, 'period-tab.png') });
  }

  // 13. Click Ecc tab
  console.log('13. Capturing Eccentricity tab...');
  const eccTab = page.locator('button:has-text("Ecc")');
  if (await eccTab.isVisible().catch(() => false)) {
    await eccTab.click();
    await page.waitForTimeout(500);
    await bottomPanel.screenshot({ path: path.join(SCREENSHOTS_DIR, 'ecc-tab.png') });
  }

  // Switch back to Distance tab
  const distanceTab = page.locator('button:has-text("Distance")');
  if (await distanceTab.isVisible().catch(() => false)) {
    await distanceTab.click();
    await page.waitForTimeout(300);
  }

  // 14. Fullscreen distance graph
  console.log('14. Capturing fullscreen graph...');
  const expandButton = page.locator('button[title="Expand to fullscreen"]');
  if (await expandButton.isVisible().catch(() => false)) {
    await expandButton.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fullscreen-graph.png') });

    // 15. Zoom in
    console.log('15. Capturing zoomed graph...');
    const modal = page.locator('.fixed.inset-0').first();
    if (await modal.isVisible().catch(() => false)) {
      await modal.hover({ position: { x: 500, y: 300 } });
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fullscreen-graph-zoomed.png') });
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 16. Paste TLE dialog
  console.log('16. Capturing paste TLE dialog...');
  const pasteTleLink = page.locator('text=Paste TLEs').first();
  if (await pasteTleLink.isVisible().catch(() => false)) {
    await pasteTleLink.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'paste-tle-dialog.png') });
    await page.keyboard.press('Escape');
  }

  await browser.close();
  console.log('\nAll screenshots captured successfully!');
}

captureUsageScreenshots().catch(console.error);
