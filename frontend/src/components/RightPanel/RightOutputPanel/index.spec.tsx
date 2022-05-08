import { test, expect } from '@playwright/experimental-ct-react';
import RightOutputPanel from '.';
import type { ExecutionResponse } from '../../../utils';

test('it should display the version and output', async ({ mount }) => {
  var response: ExecutionResponse = {
    duration: 12345,
    files: [],
    success: true,
    version: '1.2.3',
    output: 'mixed-stdout/stderr',
  }
  const component = await mount(<RightOutputPanel resp={response} />);
  await expect(component.locator('text=Duration of 12345 ms with Playwright version 1.2.3.')).toBeVisible();
});

test('it should render images correctly', async ({ mount, page }) => {
  var response: ExecutionResponse = {
    duration: 12345,
    files: [
      {
        extension: '.jpg',
        publicURL: 'https://example.com/image.jpg',
        fileName: 'my-cat.jpg'
      },
      {
        extension: '.png',
        publicURL: 'https://example.com/image.png',
        fileName: 'my-cat.png'
      }
    ],
    success: true,
    version: '',
    output: '',
  }
  await mount(<RightOutputPanel resp={response} />);
  await expect(page.locator('data-test-id=file')).toHaveCount(2);

  await expect(page.locator('data-test-id=file').nth(0)).toContainText('my-cat.jpg');
  await expect(page.locator('data-test-id=file').nth(0).locator("img")).toHaveAttribute('src', 'https://example.com/image.jpg');
  await expect(page.locator('data-test-id=file').nth(0).locator("img")).toHaveAttribute('alt', 'my-cat.jpg');

  await expect(page.locator('data-test-id=file').nth(1)).toContainText('my-cat.png');
  await expect(page.locator('data-test-id=file').nth(1).locator("img")).toHaveAttribute('src', 'https://example.com/image.png');
  await expect(page.locator('data-test-id=file').nth(1).locator("img")).toHaveAttribute('alt', 'my-cat.png');
});

test('it should display errors', async ({ mount }) => {
  var response: ExecutionResponse = {
    error: 'Some network issue',
  }
  const component = await mount(<RightOutputPanel resp={response} />);
  await expect(component.locator('text=Error')).toBeVisible();
  await expect(component.locator('text=Some network issue')).toBeVisible();
});

test('it should transform output and display the lines accordingly', async ({ mount, page }) => {
  var response: ExecutionResponse = {
    output: 'line1\nline2\nline3',
  }
  await mount(<RightOutputPanel resp={response} />);
  expect(await page.locator('code').innerText()).toBe('line1\nline2\nline3\n');
});
