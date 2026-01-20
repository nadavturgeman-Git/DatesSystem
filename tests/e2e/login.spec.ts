import { test, expect } from '@playwright/test';

test.describe('דף התחברות', () => {
  test('טוען את דף ההתחברות', async ({ page }) => {
    await page.goto('/login');
    
    // Should have login form elements
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('מציג כפתור התחברות', async ({ page }) => {
    await page.goto('/login');
    
    // Should have submit button
    const submitButton = page.getByRole('button', { name: 'התחבר', exact: true });
    await expect(submitButton).toBeVisible();
  });

  test('שגיאה בהתחברות עם פרטים שגויים', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in invalid credentials
    await page.locator('input[type="email"], input[name="email"]').fill('invalid@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    
    // Submit
    const submitButton = page.getByRole('button', { name: 'התחבר', exact: true });
    await submitButton.click();
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Should show error or stay on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('לינק להרשמה מדף התחברות', async ({ page }) => {
    await page.goto('/login');
    
    // Check for signup link
    const signupLink = page.locator('a[href*="signup"], a:has-text("הירשם")');
    
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await expect(page).toHaveURL(/.*signup/);
    }
  });
});

test.describe('דף הרשמה', () => {
  test('טוען את דף ההרשמה', async ({ page }) => {
    await page.goto('/signup');
    
    // Should have registration form elements
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
  });

  test('מציג שדות הרשמה', async ({ page }) => {
    await page.goto('/signup');
    
    // Should have email and password fields at minimum
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input#password');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });
});
