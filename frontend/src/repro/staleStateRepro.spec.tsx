import { test, expect } from '@playwright/experimental-ct-react'
import { StaleStateRepro } from './staleStateRepro'

test('setState is stale in the same click; only a ref written in the setter is current', async ({ mount }) => {
  const component = await mount(<StaleStateRepro />)
  await component.getByRole('button', { name: 'select-and-run' }).click()

  await expect(component.getByTestId('same-tick-render')).toHaveText('')
  await expect(component.getByTestId('same-tick-setter-ref')).toHaveText('example-8-code')
  await expect(component.getByTestId('same-tick-effect-ref')).toHaveText('')

  await expect(component.getByTestId('after-await-closure')).toHaveText('')
  await expect(component.getByTestId('after-await-setter-ref')).toHaveText('example-8-code')
})
