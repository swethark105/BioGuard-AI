
import { test, expect } from '@playwright/test';

test.describe('BioGuard AI - Human Review Workflow', () => {

  test('AI proposals are displayed in the dashboard', async ({ page }) => {
    await page.goto('/ai-review');

    await expect(page.getByRole('heading', { name: 'REQ-001' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'REQ-002' })).toBeVisible();

    const scenarios = page.locator('section.card');
    await expect(scenarios).toHaveCount(5);
  });

  test('reviewer comment is mandatory', async ({ page }) => {
    await page.goto('/ai-review');

    const scenario = page.locator('section.card').filter({
      has: page.getByRole('heading', { name: 'REQ-003' })
    });

    await scenario.locator('textarea').fill('');
    await scenario.getByRole('button', { name: 'Approve' }).click();

    await expect(scenario.getByRole('status')).toHaveText(
      'Please enter a reviewer comment.'
    );
  });

  test('QA engineer can request revision and decision persists', async ({ page }) => {
    await page.goto('/ai-review');

    const scenario = page.locator('section.card').filter({
      has: page.getByRole('heading', { name: 'REQ-003' })
    });

    await scenario.locator('textarea').fill(
      'Add boundary and negative test scenarios.'
    );

    await scenario.getByRole('button', { name: 'Request Revision' }).click();

    await expect(scenario.getByRole('status')).toHaveText(
      'Review saved successfully.'
    );

    await page.reload();

    const updatedScenario = page.locator('section.card').filter({
      has: page.getByRole('heading', { name: 'REQ-003' })
    });

    await expect(updatedScenario.locator('.status')).toHaveText('Status: REVISE');
    await expect(updatedScenario.locator('textarea')).toHaveValue(
      'Add boundary and negative test scenarios.'
    );
  });

});
