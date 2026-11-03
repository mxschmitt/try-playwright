import { test, expect } from '@playwright/test';

test('it links to the GitHub commit', async ({ mount }) => {
  const sha = 'a1b2c3d4e5f67890abcdef1234567890abcdef12';
  const component = await mount('try-playwright-frontend/components/Footer/WithSha', { sha });
  const link = component.getByRole('link', { name: 'a1b2c3d' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    'href',
    `https://github.com/mxschmitt/try-playwright/commit/${sha}`
  );
});
