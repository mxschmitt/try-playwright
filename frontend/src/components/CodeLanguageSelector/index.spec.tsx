import { test, expect } from '@playwright/experimental-ct-react';
import CodeLanguageSelector from '.';
import { CodeLanguage } from '../../constants';

test('it should work', async ({ mount, page }) => {
  const receivedEventCalls: CodeLanguage[] = [];
  const component = await mount(
    <CodeLanguageSelector
      codeLanguage={CodeLanguage.PYTHON}
      onLanguageChange={newLanguage => receivedEventCalls.push(newLanguage)}
    />
  )
  await expect(component.locator('text=Python')).toBeVisible();
  await component.locator('div[role="combobox"]:has-text("Python")').click();
  await page.locator('text=.NET').click();
  expect(receivedEventCalls).toEqual([CodeLanguage.DOTNET]);
});
