import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

async function fixScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,  // 1080p resolution
  });
  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173');

  // Wait for the app to fully load
  console.log('Waiting for app to load...');
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);

  const sidebar = page.locator('.w-\\[20rem\\]').first();
  const sidebarBox = await sidebar.boundingBox();

  // 1. Fix Orbital Parameters panel - capture just this section
  console.log('1. Capturing Orbital Parameters panel...');
  await sidebar.evaluate(el => el.scrollTop = 340);
  await page.waitForTimeout(500);

  // Find the "ORBITAL PARAMETERS" text and capture from there
  const orbitalText = page.locator('text=ORBITAL PARAMETERS').first();
  if (await orbitalText.isVisible()) {
    const orbitalBox = await orbitalText.boundingBox();
    if (orbitalBox && sidebarBox) {
      // Capture from the header down to include TLE Epoch row fully
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'orbital-parameters.png'),
        clip: {
          x: sidebarBox.x,
          y: orbitalBox.y - 10,  // Start just above header
          width: sidebarBox.width,
          height: 580  // Include all elements through TLE Epoch fully
        }
      });
      console.log('   Orbital Parameters captured');
    }
  }

  // 2. Fix Close Approaches panel - capture just this section
  console.log('2. Capturing Close Approaches panel...');
  await sidebar.evaluate(el => el.scrollTop = 750);
  await page.waitForTimeout(500);

  // Find the "CLOSE APPROACHES" text and capture from there
  const approachesText = page.locator('text=CLOSE APPROACHES').first();
  if (await approachesText.isVisible()) {
    const approachesBox = await approachesText.boundingBox();
    if (approachesBox && sidebarBox) {
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'close-approaches.png'),
        clip: {
          x: sidebarBox.x,
          y: approachesBox.y - 15,  // Start just above header
          width: sidebarBox.width,
          height: 380  // Show header + several conjunction entries
        }
      });
      console.log('   Close Approaches captured');
    }
  }

  await browser.close();
  console.log('\nScreenshots fixed successfully!');
}

fixScreenshots().catch(console.error);
