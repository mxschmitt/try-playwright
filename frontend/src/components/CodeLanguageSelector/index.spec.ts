import { test, expect } from '@playwright/test';
import { CodeLanguage } from '../../constants';

test('it should work', async ({ mount, page }) => {
  const component = await mount('try-playwright-frontend/components/CodeLanguageSelector/index/Python');
  await expect(component.locator('text=Python')).toBeVisible();
  await component.locator('div[role="combobox"]:has-text("Python")').click();
  await page.locator('text=.NET').click();
  await expect(component.getByTestId('selected-language')).toHaveValue(CodeLanguage.DOTNET);
});
