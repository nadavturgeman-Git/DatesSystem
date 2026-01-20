import { test, expect } from '@playwright/test';

test.describe('דף הבית', () => {
  test('טוען את דף הבית בהצלחה', async ({ page }) => {
    await page.goto('/');
    
    // Check for main heading
    await expect(page.locator('h1')).toContainText('מערכת ניהול חוות תמרים');
    
    // Check for main CTA buttons
    await expect(page.getByRole('link', { name: /הזמן תמרים/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /התחבר למערכת/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /הירשם/ })).toBeVisible();
  });

  test('ניווט לקטלוג מדף הבית', async ({ page }) => {
    await page.goto('/');
    
    // Click the order button
    await page.getByRole('link', { name: /הזמן תמרים/ }).click();
    
    // Should navigate to catalog
    await expect(page).toHaveURL(/.*catalog/);
  });

  test('ניווט להתחברות מדף הבית', async ({ page }) => {
    await page.goto('/');
    
    // Click login button
    await page.getByRole('link', { name: /התחבר למערכת/ }).click();
    
    // Should navigate to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('Features section מוצג', async ({ page }) => {
    await page.goto('/');
    
    // Check features are displayed
    await expect(page.getByText('ניהול מלאי FIFO')).toBeVisible();
    await expect(page.getByText('חישוב עמלות דינמי')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'דפי משלוח' })).toBeVisible();
  });
});
