import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// The proposals shown come either from the demo fixture or from a locally
// generated AI run, so the tests read them from the API instead of assuming
// fixed requirement IDs.
async function proposalIds(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/api/ai/proposals');
  expect(response.status()).toBe(200);
  const data = await response.json();
  return Object.keys(data.proposals || {});
}

function card(page: Page, id: string) {
  return page.locator('section.card').filter({
    has: page.getByRole('heading', { name: id, exact: true })
  });
}

test.describe('BioGuard AI - Human Review Workflow', () => {

  test('AI-001 AI proposals are displayed in the dashboard', async ({ page, request }) => {
    const ids = await proposalIds(request);
    expect(ids.length).toBeGreaterThan(0);

    await page.goto('/ai-review');

    await expect(page.locator('section.card')).toHaveCount(ids.length);
    for (const id of ids) {
      await expect(page.getByRole('heading', { name: id, exact: true })).toBeVisible();
      await expect(card(page, id).locator('.status')).toHaveText('Status: PROPOSED');
    }
  });

  test('AI-002 reviewer comment is mandatory', async ({ page, request }) => {
    const [id] = await proposalIds(request);
    await page.goto('/ai-review');

    const scenario = card(page, id);
    await scenario.locator('textarea').fill('');
    await scenario.getByRole('button', { name: 'Approve' }).click();

    await expect(scenario.getByRole('status')).toHaveText(
      'Please enter a reviewer comment.'
    );
    await expect(scenario.locator('.status')).toHaveText('Status: PROPOSED');
  });

  test('AI-003 QA engineer can request revision and decision persists', async ({ page, request }) => {
    const [id] = await proposalIds(request);
    await page.goto('/ai-review');

    const scenario = card(page, id);
    await scenario.locator('textarea').fill(
      'Add boundary and negative test scenarios.'
    );
    await scenario.getByRole('button', { name: 'Request Revision' }).click();

    await expect(scenario.getByRole('status')).toHaveText(
      'Review saved successfully.'
    );

    await page.reload();

    const updatedScenario = card(page, id);
    await expect(updatedScenario.locator('.status')).toHaveText('Status: REVISE');
    await expect(updatedScenario.locator('textarea')).toHaveValue(
      'Add boundary and negative test scenarios.'
    );
  });

});
