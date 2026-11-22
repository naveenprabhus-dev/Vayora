import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Phase 1 Authentication Shell & WCAG 2.2 AA System Verification', () => {
  test('enforces verified-account gate, keyboard skip link, protected-route redirect, and WCAG 2.2 AA', async ({
    page,
  }) => {
    await page.goto('/?view=onboarding');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Sign in to Urban Air Quality Assistant/i,
      }),
    ).toBeVisible();

    // Protected route attempt redirects to login with an informative banner
    await expect(page.getByRole('status')).toContainText(
      /Sign in with a verified household account/i,
    );

    // Keyboard Tab reaches skip link first
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();

    // Verify backend health endpoint directly stays operational
    const healthRes = await page.request.get('/api/v1/health');
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.success).toBe(true);
    expect(healthJson.data.status).toBe('ok');

    // Full-page axe-core WCAG 2.2 AA audit on Login shell
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
