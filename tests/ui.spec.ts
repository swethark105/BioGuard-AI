import {test,expect} from '@playwright/test';
test('UI-001 displays three fictional samples',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'Sample Analysis Overview'})).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.getByText('SYN-001')).toBeVisible()});
test('UI-002 displays review classification',async({page})=>{await page.goto('/');await expect(page.locator('tbody tr').filter({hasText:'SYN-003'})).toContainText('REVIEW')});
