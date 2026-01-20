import { test, expect } from '@playwright/test';

const DISTRIBUTOR_ID = '8bbb6849-1486-4383-b81b-0e0d16c52f76';

// Mobile viewport
const mobileViewport = { width: 390, height: 844 };
// Tablet viewport
const tabletViewport = { width: 820, height: 1180 };
// Desktop viewport
const desktopViewport = { width: 1920, height: 1080 };

test.describe('רספונסיביות - מובייל', () => {
  test('דף הבית במובייל', async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto('/');
    
    // Should render properly on mobile
    await expect(page.locator('h1')).toContainText('מערכת ניהול חוות תמרים');
    
    // Buttons should be visible
    await expect(page.getByRole('link', { name: /הזמן תמרים/ })).toBeVisible();
  });

  test('דף הזמנה במובייל', async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Header should be visible
    await expect(page.locator('h1')).toContainText('הזמנת תמרים');
  });

  test('התחברות במובייל', async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto('/login');
    
    // Form should be visible and usable
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe('רספונסיביות - טאבלט', () => {
  test('דף הבית בטאבלט', async ({ page }) => {
    await page.setViewportSize(tabletViewport);
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('מערכת ניהול חוות תמרים');
    
    // Features grid should be visible
    await expect(page.getByText('ניהול מלאי FIFO')).toBeVisible();
  });

  test('דף הזמנה בטאבלט', async ({ page }) => {
    await page.setViewportSize(tabletViewport);
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h1')).toContainText('הזמנת תמרים');
  });
});

test.describe('רספונסיביות - דסקטופ', () => {
  test('דף הבית בדסקטופ גדול', async ({ page }) => {
    await page.setViewportSize(desktopViewport);
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('מערכת ניהול חוות תמרים');
    
    // All features should be visible in grid
    await expect(page.getByText('ניהול מלאי FIFO')).toBeVisible();
    await expect(page.getByText('חישוב עמלות דינמי')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'דפי משלוח' })).toBeVisible();
  });
});
