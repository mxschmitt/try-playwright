import { test, expect } from '@playwright/experimental-ct-react';
import App from '.';
import CodeContextProvider from '../CodeContext';

test('desktop layout fills the viewport in two aligned columns', async ({ mount, page }) => {
  await page.addStyleTag({ content: 'html, body, #root { height: 100%; margin: 0; }' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await mount(
    <CodeContextProvider>
      <App />
    </CodeContextProvider>
  );

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
});
