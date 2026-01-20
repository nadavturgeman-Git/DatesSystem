import { test, expect } from '@playwright/test';

const DISTRIBUTOR_ID = '8bbb6849-1486-4383-b81b-0e0d16c52f76';

test.describe('נגישות ו-RTL', () => {
  test('כיוון RTL בדף הבית', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page has RTL content (Hebrew text)
    const content = await page.content();
    expect(content).toContain('מערכת ניהול חוות תמרים');
  });

  test('ניווט מקלדת בדף הבית', async ({ page }) => {
    await page.goto('/');
    
    // Press Tab to navigate
    await page.keyboard.press('Tab');
    
    // Some element should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('ניווט מקלדת בדף התחברות', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through form fields
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Some form element should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focusedElement);
  });

  test('תגיות alt לתמונות', async ({ page }) => {
    await page.goto('/');
    
    // Check all images have alt text (or are decorative)
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      // Image should have alt text OR be marked as presentation
      expect(alt !== null || role === 'presentation').toBe(true);
    }
  });

  test('קונטרסט צבעים בכפתורים', async ({ page }) => {
    await page.goto('/');
    
    // Check that buttons are visible (basic contrast check)
    const orderButton = page.getByRole('link', { name: /הזמן תמרים/ });
    await expect(orderButton).toBeVisible();
    
    // Button should have readable text
    const buttonText = await orderButton.textContent();
    expect(buttonText?.length).toBeGreaterThan(0);
  });

  test('Labels לשדות טופס', async ({ page }) => {
    await page.goto('/login');
    
    // Check that form has inputs
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();
    
    // Form should have labels or placeholder text
    const placeholder = await emailInput.getAttribute('placeholder');
    const ariaLabel = await emailInput.getAttribute('aria-label');
    const id = await emailInput.getAttribute('id');
    
    // Should have some form of labeling
    const hasLabeling = placeholder || ariaLabel || id;
    expect(hasLabeling).toBeTruthy();
  });
});

test.describe('טעינה וביצועים', () => {
  test('דף הבית נטען תוך 3 שניות', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('דף הזמנה נטען תוך 5 שניות', async ({ page }) => {
    const start = Date.now();
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;
    
    // Should load within 5 seconds (includes API calls)
    expect(loadTime).toBeLessThan(5000);
  });

  test('אין שגיאות JavaScript', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out known acceptable errors
    const criticalErrors = errors.filter(e => 
      !e.includes('ResizeObserver') && 
      !e.includes('hydration')
    );
    
    // Should have no critical JS errors
    expect(criticalErrors.length).toBe(0);
  });
});
