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

// FIXME: market/oracle reads moved client-side (viem RPC) in the Vercel-edge pivot, so the
// /api/markets and /api/oracle/validation route mocks below no longer intercept anything.
// This spec needs RPC-level mocking (encode multicall3 aggregate3 responses) before it can
// run deterministically again.
test.fixme('operator can switch envs, update a market, and see atomic tx rules', async ({ page }) => {
  await page.route('**/api/markets?**', async (route) => {
    const env = new URL(route.request().url()).searchParams.get('env') ?? 'staging'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        env,
        markets: marketsByEnv[env as keyof typeof marketsByEnv] ?? [],
      }),
    })
  })
  await page.route('**/api/oracle/validation?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        validation: {
          expectedIndexPriceId: '0x7321ce442e8814b638e0cd241a8838e7d8222a43cbaaca78adcc2337bfa3185d',
          expectedMarkPriceId: '0x98848cd117152974f79fb357720f794415ab653bc2c2dd4548395dc2c4123440',
          actualIndexPriceId: '0x7321ce442e8814b638e0cd241a8838e7d8222a43cbaaca78adcc2337bfa3185d',
          actualMarkPriceId: '0x98848cd117152974f79fb357720f794415ab653bc2c2dd4548395dc2c4123440',
          indexPrice: '100000000',
          markPrice: '100100000',
          indexPriceIdMatches: true,
          markPriceIdMatches: true,
          indexPriceLive: true,
          markPriceLive: true,
        },
      }),
    })
  })
  const stagingMarket = marketsByEnv.staging[0]!
  const testnetMarket = marketsByEnv.testnet[0]!
  const stagingTicker = `${stagingMarket.symbol}/USDC`
  const testnetTicker = `${testnetMarket.symbol}/USDC`

  await page.goto('/')

  await expect(page.getByText(/market-admin/i)).toBeVisible()
  await expect(page.getByRole('group', { name: /environment/i }).getByRole('button', { name: /environment staging/i })).toBeVisible()
  await expect(page.getByText(stagingTicker).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/1 markets/i).first()).toBeVisible()

  await selectEnv(page, 'testnet')
  await expect(page.getByText(testnetTicker).first()).toBeVisible({ timeout: 20_000 })

  await selectEnv(page, 'staging')
  await expect(page.getByText(stagingTicker).first()).toBeVisible({ timeout: 20_000 })
  await page.getByText(stagingTicker).first().click()
  await page.getByRole('button', { name: /update market/i }).click()
  await expect(page.getByText(new RegExp(`Update Market.*#${stagingMarket.id} ${stagingTicker}`, 'i'))).toBeVisible()
  await expect(page.getByLabel(/Step size/)).toHaveValue(String(stagingMarket.stepSize))
  await expect(page.getByLabel(/Step size/)).toBeDisabled()
  await expect(page.getByLabel(/Step price/)).toHaveValue(String(stagingMarket.stepPrice))
  await expect(page.getByLabel(/Step price/)).toBeDisabled()
  await expect(page.getByText(/immutable after open/i).first()).toBeVisible()
  await expect(page.getByText(/updateMarketConfig/).first()).toBeVisible()
  await expect(page.getByText(/index 100000000 · mark 100100000/i)).toBeVisible()

  await page.getByRole('button', { name: /open market/i }).click()
  await page.getByRole('button', { name: /AERO\/USDC example/i }).click()
  await expect(page.getByLabel(/Market name/i)).toHaveValue('AERO')
  await expect(page.getByLabel(/Quote/i)).toContainText('USDC')
  await expect(page.getByLabel(/Step price/i)).toHaveValue('0.00001')
  await expect(page.getByText(/raw:/).first()).toBeVisible()

  await selectEnv(page, 'mainnet')
  await expect(page.getByText(/AccessManager\.multicall/).last()).toBeVisible()
  await expect(page.getByText(/Atomic transaction JSON/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /send wallet tx/i })).toBeDisabled()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

  await selectEnv(page, 'staging')
  await expect(page.getByText(/Atomic transaction JSON/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /send wallet tx/i })).toBeDisabled()
  await expect(page.getByRole('button', { name: /connect/i })).toBeVisible()
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
  staging: [market({ id: 4, symbol: 'DOGE', quote: 'USDT', stepSize: 10, stepPrice: 0.000001 })],
  testnet: [market({ id: 3, symbol: 'PEPE', stepSize: 1000, stepPrice: 0.00000001 })],
  mainnet: [market({ id: 1, symbol: 'BTC' })],
  shadow: [market({ id: 2, symbol: 'ETH' })],
}
