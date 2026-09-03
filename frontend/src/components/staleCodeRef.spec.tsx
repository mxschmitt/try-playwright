import { test, expect } from '@playwright/experimental-ct-react'
import { StaleCodeRefRepro } from './staleCodeRef'

test('render state is stale in the same click as onChange; getCode is not', async ({ mount }) => {
  const component = await mount(<StaleCodeRefRepro />)
  await component.getByRole('button', { name: 'select-and-read' }).click()
  await expect(component.getByTestId('from-render')).toHaveText('')
  await expect(component.getByTestId('from-ref')).toHaveText('example-8-code')
})
