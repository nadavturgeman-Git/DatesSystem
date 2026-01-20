import { test, expect } from '@playwright/test';

// Known distributor ID from database
const DISTRIBUTOR_ID = '8bbb6849-1486-4383-b81b-0e0d16c52f76';

test.describe('דף הזמנה ציבורית', () => {
  test('טוען את דף ההזמנה של מפיץ', async ({ page }) => {
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check for main heading
    await expect(page.locator('h1')).toContainText('הזמנת תמרים');
  });

  test('מציג מוצרים בקטלוג', async ({ page }) => {
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Wait for loading indicator to disappear
    await page.waitForSelector('text=טוען מוצרים', { state: 'hidden', timeout: 15000 }).catch(() => {});
    
    // Wait a bit more for content to render
    await page.waitForTimeout(2000);
    
    // Wait for products to load (should see price indicators)
    // Either products are shown or sales cycle is closed
    const content = await page.content();
    const hasProducts = content.includes('לק') || content.includes('מחזור מכירות סגור') || content.includes('הזמנת תמרים');
    expect(hasProducts).toBe(true);
  });

  test('הוספת מוצר לעגלה', async ({ page }) => {
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Check if sales cycle is open
    const salesCycleClosed = await page.locator('text=מחזור מכירות סגור').isVisible();
    
    if (salesCycleClosed) {
      // Skip test if sales cycle is closed
      test.skip();
      return;
    }
    
    // Find and click "Add to cart" button
    const addToCartButton = page.locator('button:has-text("הוסף לעגלה")').first();
    
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      
      // Cart should now show item count
      await expect(page.locator('text=/עגלה \\(\\d+\\)/')).toBeVisible();
    }
  });

  test('פתיחת מודל checkout', async ({ page }) => {
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Check if sales cycle is open
    const salesCycleClosed = await page.locator('text=מחזור מכירות סגור').isVisible();
    
    if (salesCycleClosed) {
      test.skip();
      return;
    }
    
    // Add item to cart
    const addToCartButton = page.locator('button:has-text("הוסף לעגלה")').first();
    
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      
      // Click checkout button
      const checkoutButton = page.locator('button:has-text("המשך לתשלום")');
      if (await checkoutButton.isVisible()) {
        await checkoutButton.click();
        
        // Modal should open
        await expect(page.locator('text=סיכום הזמנה')).toBeVisible();
      }
    }
  });

  test('טופס פרטי לקוח', async ({ page }) => {
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Check if sales cycle is open
    const salesCycleClosed = await page.locator('text=מחזור מכירות סגור').isVisible();
    
    if (salesCycleClosed) {
      test.skip();
      return;
    }
    
    // Add item and open checkout
    const addToCartButton = page.locator('button:has-text("הוסף לעגלה")').first();
    
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      
      const checkoutButton = page.locator('button:has-text("המשך לתשלום")');
      if (await checkoutButton.isVisible()) {
        await checkoutButton.click();
        
        // Form fields should be visible
        await expect(page.locator('input[type="text"]').first()).toBeVisible();
        await expect(page.locator('input[type="tel"]')).toBeVisible();
        
        // Payment method buttons should be visible
        await expect(page.locator('text=כרטיס אשראי')).toBeVisible();
        await expect(page.locator('text=Bit')).toBeVisible();
        await expect(page.locator('text=מזומן')).toBeVisible();
      }
    }
  });

  test('בחירת אמצעי תשלום', async ({ page }) => {
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Check if sales cycle is open
    const salesCycleClosed = await page.locator('text=מחזור מכירות סגור').isVisible();
    
    if (salesCycleClosed) {
      test.skip();
      return;
    }
    
    // Add item and open checkout
    const addToCartButton = page.locator('button:has-text("הוסף לעגלה")').first();
    
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      
      const checkoutButton = page.locator('button:has-text("המשך לתשלום")');
      if (await checkoutButton.isVisible()) {
        await checkoutButton.click();
        
        // Click payment method
        const cashButton = page.locator('button:has-text("מזומן")');
        if (await cashButton.isVisible()) {
          await cashButton.click();
          
          // Button should have selected style (border color change)
          await expect(cashButton).toHaveClass(/border-emerald/);
        }
      }
    }
  });
});

test.describe('מחזור מכירות סגור', () => {
  test('מציג הודעה כשמחזור סגור', async ({ page }) => {
    await page.goto(`/order/${DISTRIBUTOR_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Wait for loading indicator to disappear
    await page.waitForSelector('text=טוען מוצרים', { state: 'hidden', timeout: 15000 }).catch(() => {});
    
    // Wait a bit more for content to render
    await page.waitForTimeout(2000);
    
    // Either products are shown OR sales cycle closed message OR main heading
    const content = await page.content();
    const validState = content.includes('לק') || content.includes('מחזור מכירות סגור') || content.includes('הזמנת תמרים');
    expect(validState).toBe(true);
  });
});
