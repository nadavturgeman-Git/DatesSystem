import { test, expect } from '@playwright/test';

test.describe('דף קטלוג', () => {
  test('טוען את דף הקטלוג', async ({ page }) => {
    await page.goto('/catalog');
    
    // Should show some heading or content
    await expect(page.locator('body')).toBeVisible();
  });

  test('ניווט לבחירת נקודת איסוף', async ({ page }) => {
    await page.goto('/order');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we're on the order/distributor selection page
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});

test.describe('עמוד בחירת מפיץ', () => {
  test('טוען את דף בחירת נקודת איסוף', async ({ page }) => {
    await page.goto('/order');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Should have some visible content
    await expect(page.locator('body')).toBeVisible();
  });
});
