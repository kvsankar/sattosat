import { test, expect, Page } from '@playwright/test';

// Helper to wait for satellite catalog to load (inputs become enabled)
async function waitForCatalogLoaded(page: Page, timeout = 30000) {
  const inputA = page.locator('input[placeholder="Search satellites..."]').first();
  await expect(inputA).toBeEnabled({ timeout });
}

test.describe('Satellite Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for app to load
    await page.waitForSelector('canvas', { timeout: 30000 });
    // Wait extra time for initial render
    await page.waitForTimeout(2000);
  });

  test('app loads with default profile', async ({ page }) => {
    // Check that the default profile is loaded
    const profileDropdown = page.locator('select').first();
    await expect(profileDropdown).toBeVisible();

    // The first profile should be selected by default
    const selectedValue = await profileDropdown.inputValue();
    expect(selectedValue).toBeTruthy();
  });

  test('default profile shows historical anchor time (not now)', async ({ page }) => {
    // Wait for profile to load
    await page.waitForTimeout(2000);

    // Find the anchor time display - it should show a date in the past (Dec 2025 for the profile)
    // The distance graph title or timeline should show historical dates
    const pageContent = await page.textContent('body');

    // Profile anchor is 2025-12-19, so we should see Dec dates, not today's date
    expect(pageContent).toContain('Dec');
  });

  test('satellite catalog loads and enables input', async ({ page }) => {
    // Wait for catalog to load (can take up to 30s for network fetch)
    await waitForCatalogLoaded(page, 60000);

    // Check that both satellite inputs are enabled
    const inputA = page.locator('input[placeholder="Search satellites..."]').first();
    const inputB = page.locator('input[placeholder="Search satellites..."]').nth(1);

    await expect(inputA).toBeEnabled();
    await expect(inputB).toBeEnabled();
  });

  test('can search for satellite by NORAD ID', async ({ page }) => {
    await waitForCatalogLoaded(page, 60000);

    // Click on first satellite input and search for ISS (25544)
    const inputA = page.locator('input[placeholder="Search satellites..."]').first();
    await inputA.click();
    await inputA.fill('25544');

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Should see ISS in the dropdown (use specific selector for dropdown)
    const dropdown = page.locator('.max-h-60');
    await expect(dropdown).toBeVisible();

    const issOption = dropdown.locator('button:has-text("ISS")').first();
    await expect(issOption).toBeVisible();
  });

  test('selecting satellite updates the display', async ({ page }) => {
    await waitForCatalogLoaded(page, 60000);

    // Select ISS as Satellite A
    const inputA = page.locator('input[placeholder="Search satellites..."]').first();
    await inputA.click();
    await inputA.fill('25544');
    await page.waitForTimeout(500);

    // Click the ISS option (use specific dropdown selector)
    const issOption = page.locator('.max-h-60 button:has-text("ISS")').first();
    await issOption.click();

    // Wait for selection to register and input to blur
    await page.waitForTimeout(500);

    // The input should now show ISS (need to check after blur)
    await page.locator('body').click(); // Click elsewhere to ensure blur
    await page.waitForTimeout(300);

    const inputValue = await inputA.inputValue();
    expect(inputValue).toContain('ISS');
  });

  test('changing satellite after profile load resets anchor to now', async ({ page }) => {
    await waitForCatalogLoaded(page, 60000);

    // Verify profile is loaded first
    const profileDropdown = page.locator('select').first();
    const initialProfileValue = await profileDropdown.inputValue();
    console.log('Initial profile:', initialProfileValue);
    expect(initialProfileValue).toContain('WV3-STARLINK35956');

    // Get initial anchor time from the timeline display
    const timelineText = await page.locator('text=/2025-12-\\d+/').first().textContent();
    console.log('Initial timeline date:', timelineText);
    expect(timelineText).toContain('2025-12-19'); // Profile anchor date

    // Change Satellite A by selecting a different satellite
    const inputA = page.locator('input[placeholder="Search satellites..."]').first();
    await inputA.click();
    await inputA.fill('25544'); // Search for ISS
    await page.waitForTimeout(800);

    // Click the ISS option in dropdown (more specific selector)
    const issButton = page.locator('.max-h-60 button:has-text("ISS")').first();
    await expect(issButton).toBeVisible();
    await issButton.click();

    // Wait for state update
    await page.waitForTimeout(1000);

    // Verify profile was cleared
    const newProfileValue = await profileDropdown.inputValue();
    console.log('New profile value:', newProfileValue);

    // Profile should be cleared (empty string means "Select a profile..." option selected)
    expect(newProfileValue).toBe('');

    // Verify anchor time changed from profile date (Dec 19) to current time
    const newTimelineText = await page.locator('text=/2025-12-\\d+/').first().textContent();
    console.log('New timeline date:', newTimelineText);

    // The new date should NOT be Dec 19 (the profile's anchor date)
    expect(newTimelineText).not.toContain('2025-12-19');

    // It should be a recent date (Dec 25 or Dec 26 depending on timezone)
    const hasRecentDate = newTimelineText?.includes('2025-12-25') || newTimelineText?.includes('2025-12-26');
    expect(hasRecentDate).toBeTruthy();
  });

  test('can select two different satellites', async ({ page }) => {
    await waitForCatalogLoaded(page, 60000);

    // Select ISS as Satellite A
    const inputA = page.locator('input[placeholder="Search satellites..."]').first();
    await inputA.click();
    await inputA.fill('25544');
    await page.waitForTimeout(500);

    const issOption = page.locator('.max-h-60 button:has-text("ISS")').first();
    await issOption.click();
    await page.waitForTimeout(1000);

    // Select Hubble as Satellite B
    const inputB = page.locator('input[placeholder="Search satellites..."]').nth(1);
    await inputB.click();
    await inputB.fill('20580');
    await page.waitForTimeout(500);

    const hstOption = page.locator('.max-h-60 button:has-text("HST")').first();
    await hstOption.click();
    await page.waitForTimeout(1000);

    // Click elsewhere to blur
    await page.locator('body').click();
    await page.waitForTimeout(300);

    // Verify both are selected
    const valueA = await inputA.inputValue();
    const valueB = await inputB.inputValue();

    expect(valueA).toContain('ISS');
    expect(valueB).toContain('HST');
  });

  test('conjunction calculation runs after selecting satellites', async ({ page }) => {
    await waitForCatalogLoaded(page, 60000);

    // Select ISS as Satellite A
    const inputA = page.locator('input[placeholder="Search satellites..."]').first();
    await inputA.click();
    await inputA.fill('25544');
    await page.waitForTimeout(500);
    await page.locator('.max-h-60 button:has-text("ISS")').first().click();
    await page.waitForTimeout(1000);

    // Select NOAA-20 as Satellite B
    const inputB = page.locator('input[placeholder="Search satellites..."]').nth(1);
    await inputB.click();
    await inputB.fill('43013');
    await page.waitForTimeout(500);
    await page.locator('.max-h-60 button:has-text("NOAA")').first().click();

    // Wait for conjunction calculation (can take 10+ seconds)
    await page.waitForTimeout(15000);

    // Check that Close Approaches section exists and has content
    const closeApproachesSection = page.locator('text=Close Approaches');
    await expect(closeApproachesSection).toBeVisible();

    // Should have some conjunction results (or "No close approaches")
    const hasResults = await page.locator('text=/\\d+ km/').first().isVisible().catch(() => false);
    const noResults = await page.locator('text=No close approaches').isVisible().catch(() => false);

    expect(hasResults || noResults).toBeTruthy();
  });

  test('fullscreen distance graph can be opened', async ({ page }) => {
    await waitForCatalogLoaded(page, 60000);

    // Click expand button
    const expandButton = page.locator('button[title="Expand to fullscreen"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    // Wait for fullscreen modal
    await page.waitForTimeout(1000);

    // Should see the fullscreen graph
    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();

    // Should have "Distance Graph" title
    const title = page.locator('text=Distance Graph');
    await expect(title).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });
});
