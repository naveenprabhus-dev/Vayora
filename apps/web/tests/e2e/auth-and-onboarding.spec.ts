import fs from 'node:fs';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const HAS_FIREBASE_CLIENT_CONFIG =
  fs.existsSync(path.resolve(process.cwd(), 'firebase-applet-config.json')) ||
  Boolean(process.env.VITE_FIREBASE_API_KEY);

test.describe('Phase 1 Auth Flows, Validation & Accessibility (Playwright)', () => {
  test('validates registration form, updates password strength meter, toggles password visibility, and passes WCAG 2.2 AA', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    await expect(
      page.getByRole('heading', { level: 1, name: /Create your household account/i }),
    ).toBeVisible();

    const passwordInput = page.locator('#register-password');
    await passwordInput.fill('WinterCleanAir2026!');

    const meter = page.getByRole('progressbar', { name: 'Password strength' });
    await expect(meter).toHaveAttribute('aria-valuetext', 'Very strong');

    const toggleButton = page.getByRole('button', { name: 'Show Password' });
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide Password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Submit empty name/email/terms to verify accessible error reporting
    await page.getByRole('main').getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('provides enumeration-resistant forgot-password flow and handles invalid reset links cleanly', async ({
    page,
  }) => {
    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
      const url = route.request().url();
      if (url.includes('sendOobCode')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 400, message: 'EMAIL_NOT_FOUND' } }),
        });
        return;
      }
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 400, message: 'EXPIRED_OOB_CODE' } }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Forgot password?' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: /Reset your password/i }),
    ).toBeVisible();

    await page.getByLabel(/Email address/).fill('nobody@household.org');
    await page.getByRole('button', { name: 'Send reset instructions' }).click();

    if (HAS_FIREBASE_CLIENT_CONFIG) {
      await expect(page.getByRole('status')).toContainText(
        'If an account exists for that email address, password reset instructions have been sent.',
      );
    } else {
      await expect(page.getByRole('alert')).toContainText(
        /Authentication service is not configured/i,
      );
    }

    const forgotResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(forgotResults.violations).toEqual([]);

    // Navigate with expired oobCode
    await page.goto('/?mode=resetPassword&oobCode=expired-code-999');
    await expect(page.getByRole('alert')).toContainText(/expired|invalid/i);
    await expect(page.getByRole('button', { name: 'Request a new reset link' })).toBeVisible();

    const resetResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(resetResults.violations).toEqual([]);
  });
});
