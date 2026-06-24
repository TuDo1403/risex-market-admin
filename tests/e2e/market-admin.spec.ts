import { expect, test } from '@playwright/test'

type MarketRow = {
  id: number
  symbol: string
  quote: string
  stepSize: number
  stepPrice: number
}

async function selectEnv(page: import('@playwright/test').Page, envName: string) {
  const envSwitcher = page.getByRole('group', { name: /environment/i })
  await envSwitcher.getByRole('button', { name: /environment/i }).click()
  await page.getByRole('button', { name: new RegExp(`^${envName}`, 'i') }).click()
}

test('operator can switch envs, update a market, and see tx mode rules', async ({ page }) => {
  await page.addInitScript((fixtures) => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/markets')) {
        const parsed = new URL(url, window.location.origin)
        const env = parsed.searchParams.get('env') ?? 'staging'
        return new Response(JSON.stringify({
          env,
          markets: fixtures[env as keyof typeof fixtures] ?? [],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return originalFetch(input, init)
    }
  }, marketsByEnv)
  const stagingMarket = marketsByEnv.staging[0]!
  const testnetMarket = marketsByEnv.testnet[0]!

  await page.goto('/')

  await expect(page.getByText(/market-admin/i)).toBeVisible()
  await expect(page.getByRole('group', { name: /environment/i }).getByRole('button', { name: /environment staging/i })).toBeVisible()
  await expect(page.getByText(`${stagingMarket.symbol}/${stagingMarket.quote}`).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/1 markets/i).first()).toBeVisible()

  await selectEnv(page, 'testnet')
  await expect(page.getByText(`${testnetMarket.symbol}/${testnetMarket.quote}`).first()).toBeVisible({ timeout: 20_000 })

  await selectEnv(page, 'staging')
  await expect(page.getByText(`${stagingMarket.symbol}/${stagingMarket.quote}`).first()).toBeVisible({ timeout: 20_000 })
  await page.getByText(`${stagingMarket.symbol}/${stagingMarket.quote}`).first().click()
  await page.getByRole('button', { name: /update market/i }).click()
  await expect(page.getByText(new RegExp(`Update Market.*#${stagingMarket.id} ${stagingMarket.symbol}/${stagingMarket.quote}`, 'i'))).toBeVisible()
  await expect(page.getByLabel(/Step size/)).toHaveValue(String(stagingMarket.stepSize))
  await expect(page.getByLabel(/Step price/)).toHaveValue(String(stagingMarket.stepPrice))
  await expect(page.getByText(/updateMarketConfig/).first()).toBeVisible()

  await page.getByRole('button', { name: /open market/i }).click()
  await page.getByRole('button', { name: /AERO\/USDC example/i }).click()
  await expect(page.getByLabel(/Market name/i)).toHaveValue('AERO')
  await expect(page.getByLabel(/Quote/i)).toContainText('USDC')
  await expect(page.getByLabel(/Step price/i)).toHaveValue('0.00001')
  await expect(page.getByText(/raw:/).first()).toBeVisible()

  await selectEnv(page, 'mainnet')
  await expect(page.getByText(/Safe MultiSend/).last()).toBeVisible()
  await expect(page.getByRole('button', { name: /create Safe proposal/i })).toBeDisabled()
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('button', { name: /create Safe proposal/i })).toBeEnabled()

  await selectEnv(page, 'staging')
  await expect(page.getByText(/EOA tx batch/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /execute 3 tx/i })).toBeDisabled()
  await page.getByRole('button', { name: /connect/i }).click()
  await expect(page.getByRole('button', { name: /execute 3 tx/i })).toBeEnabled()
})

function market(partial: Partial<MarketRow> & Pick<MarketRow, 'id' | 'symbol'>) {
  return {
    ...partial,
    id: partial.id,
    symbol: partial.symbol,
    quote: partial.quote ?? 'USDC',
    status: 'unlocked',
    deferredSettlement: true,
    maxLeverage: 10,
    mmrPct: '5.0',
    mmrRaw: '4500000000000000000',
    stepSize: partial.stepSize ?? 1,
    stepSizeRaw: '1000000000000000000',
    stepPrice: partial.stepPrice ?? 0.00001,
    stepPriceRaw: '1000',
    minOrderStep: 20,
    maxOrderStep: 200000,
    oiLimitSteps: 2000000,
    impactBaseUsdc: 50,
    impactBaseRaw: '50',
    priceBandBps: 300,
    deployedAt: 'e2e',
  }
}

const marketsByEnv = {
  staging: [market({ id: 4, symbol: 'DOGE', stepSize: 10, stepPrice: 0.000001 })],
  testnet: [market({ id: 3, symbol: 'PEPE', stepSize: 1000, stepPrice: 0.00000001 })],
  mainnet: [market({ id: 1, symbol: 'BTC' })],
  shadow: [market({ id: 2, symbol: 'ETH' })],
}
