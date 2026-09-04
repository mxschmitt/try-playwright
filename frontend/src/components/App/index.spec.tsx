import { test, expect } from '@playwright/experimental-ct-react';
import type { MountResult } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import App from '.';
import CodeContextProvider from '../CodeContext';

async function mountApp(mount: (component: React.ReactElement) => Promise<MountResult>, page: Page) {
  await page.addStyleTag({ content: 'html, body, #root { height: 100%; margin: 0; }' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await mount(
    <CodeContextProvider>
      <App />
    </CodeContextProvider>
  );
}

test('desktop layout fills the viewport in two aligned columns', async ({ mount, page }) => {
  await mountApp(mount, page);

  const main = page.getByTestId('app-main');
  const editor = page.getByTestId('app-editor-column');
  const examples = page.getByTestId('app-examples-column');
  await expect(main).toBeVisible();

  const viewport = page.viewportSize()!;
  const mainBox = await main.boundingBox();
  const editorBox = await editor.boundingBox();
  const examplesBox = await examples.boundingBox();

  expect(mainBox).toBeTruthy();
  expect(editorBox).toBeTruthy();
  expect(examplesBox).toBeTruthy();

  expect(mainBox!.x).toBeLessThan(16);
  expect(Math.abs(mainBox!.width - viewport.width)).toBeLessThan(16);
  expect(Math.abs(editorBox!.width - examplesBox!.width)).toBeLessThan(24);
  expect(Math.abs(editorBox!.y - examplesBox!.y)).toBeLessThan(8);
  expect(editorBox!.x + editorBox!.width).toBeLessThanOrEqual(examplesBox!.x + 2);
  expect(editorBox!.height).toBeGreaterThan(viewport.height * 0.7);
  expect(Math.abs(editorBox!.height - examplesBox!.height)).toBeLessThan(8);
});

test('editor column stays full height after a short output error', async ({ mount, page }) => {
  await page.route('**/service/control/run', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Error: Could not complete bot check. Please try again.' }),
    });
  });
  await mountApp(mount, page);

  const viewport = page.viewportSize()!;
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByText('Could not complete bot check')).toBeVisible();

  const editorBox = await page.getByTestId('app-editor-column').boundingBox();
  const outputBox = await page.getByTestId('app-examples-column').boundingBox();
  expect(editorBox).toBeTruthy();
  expect(outputBox).toBeTruthy();
  expect(editorBox!.height).toBeGreaterThan(viewport.height * 0.7);
  expect(outputBox!.height).toBeGreaterThan(viewport.height * 0.7);
  expect(Math.abs(editorBox!.height - outputBox!.height)).toBeLessThan(8);
});
