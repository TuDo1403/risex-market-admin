import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MarketAdminConsole } from './market-admin-console'
import type { EnvKey, Market } from '@/src/lib/lovable-risex'

function textIncludes(value: string) {
  return (_content: string, node: Element | null) => node?.textContent?.includes(value) ?? false
}

describe('MarketAdminConsole Lovable source port', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      const env = (url.searchParams.get('env') ?? 'staging') as EnvKey
      return {
        ok: true,
        json: async () => ({ env, markets: marketsByEnv[env] }),
      }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('changes current markets through the top-right environment switcher', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="staging" />)

    const header = screen.getByRole('banner')
    const environment = within(header).getByRole('group', { name: /environment/i })
    expect(within(environment).getByRole('button', { name: /environment staging/i })).toBeInTheDocument()
    expect(await screen.findByText('DOGE/USDC')).toBeInTheDocument()

    await user.click(within(environment).getByRole('button', { name: /environment staging/i }))
    await user.click(screen.getByRole('button', { name: /testnet/i }))

    expect(within(environment).getByRole('button', { name: /environment testnet/i })).toBeInTheDocument()
    expect(await screen.findByText('PEPE/USDC')).toBeInTheDocument()
    expect(screen.queryByText('DOGE/USDC')).not.toBeInTheDocument()
  })

  it('opens the update editor from a current market row with live values prefilled', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="staging" />)

    await user.dblClick(await screen.findByText('DOGE/USDC'))

    expect(screen.getByText(/Update Market.*#4 DOGE\/USDC/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Step size/i)).toHaveValue(10)
    expect(screen.getByLabelText(/Step price/i)).toHaveValue(0.000001)
    expect(screen.getByText('loaded')).toBeInTheDocument()
    expect(screen.getByText(/Before \/ After/i)).toBeInTheDocument()
    expect(screen.getAllByText(/updateMarketConfig/i).length).toBeGreaterThan(0)
  })

  it('explains how to fill friendly values while showing raw conversions', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="staging" />)

    await user.click(screen.getByRole('button', { name: /open market/i }))
    await user.click(screen.getByRole('button', { name: /AERO\/USDC example/i }))

    expect(screen.getByLabelText(/Market name/i)).toHaveValue('AERO')
    expect(screen.getByLabelText(/Quote/i)).toHaveTextContent('USDC')
    expect(screen.getByLabelText(/Step size/i)).toHaveValue(1)
    expect(screen.getByLabelText(/Step price/i)).toHaveValue(0.00001)
    expect(screen.getAllByText(textIncludes('raw: 1000000000000000000')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(textIncludes('raw: 1000')).length).toBeGreaterThan(0)
    expect(screen.getByText(/USDC \(6 decimals\)/i)).toBeInTheDocument()
    expect(screen.getByText(/200 bps = 2%/i)).toBeInTheDocument()
    expect(screen.getAllByText(/setDeferredMode/i).length).toBeGreaterThan(0)
    expect(screen.getByText('FRIENDLY')).toBeInTheDocument()
    expect(screen.getByText('RAW')).toBeInTheDocument()
  })

  it('uses Safe proposal mode on mainnet and EOA execution elsewhere', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="mainnet" />)

    await user.click(screen.getByRole('button', { name: /open market/i }))
    expect(screen.getAllByText(/Safe MultiSend/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /create Safe proposal/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByRole('button', { name: /create Safe proposal/i })).toBeEnabled()

    await user.click(within(screen.getByRole('group', { name: /environment/i })).getByRole('button', { name: /environment mainnet/i }))
    await user.click(screen.getByRole('button', { name: /staging/i }))
    expect(screen.getByText(/EOA tx batch/i)).toBeInTheDocument()
    expect(screen.queryByText(/Shadow preflight/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /execute 3 tx/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /connect/i }))
    expect(screen.getByRole('button', { name: /execute 3 tx/i })).toBeEnabled()
  })

  it('shows shadow preflight only for mainnet safe proposals', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="staging" />)

    await user.click(screen.getByRole('button', { name: /open market/i }))
    expect(screen.queryByText(/Shadow preflight/i)).not.toBeInTheDocument()

    await user.click(within(screen.getByRole('group', { name: /environment/i })).getByRole('button', { name: /environment staging/i }))
    await user.click(screen.getByRole('button', { name: /^mainnet/i }))

    expect(screen.getByText(/Shadow preflight/i)).toBeInTheDocument()
  })
})

function market(partial: Partial<Market> & Pick<Market, 'id' | 'symbol'>): Market {
  const mmrRaw = partial.mmrRaw ?? '4500000000000000000'
  const stepSizeRaw = partial.stepSizeRaw ?? '1000000000000000000'
  const stepPriceRaw = partial.stepPriceRaw ?? '1000'
  const impactBaseRaw = partial.impactBaseRaw ?? '50'

  return {
    id: partial.id,
    symbol: partial.symbol,
    quote: partial.quote ?? 'USDC',
    status: partial.status ?? 'unlocked',
    deferredSettlement: partial.deferredSettlement ?? true,
    maxLeverage: partial.maxLeverage ?? 10,
    mmrPct: partial.mmrPct ?? '5.0',
    mmrRaw,
    stepSize: partial.stepSize ?? 1,
    stepSizeRaw,
    stepPrice: partial.stepPrice ?? 0.00001,
    stepPriceRaw,
    minOrderStep: partial.minOrderStep ?? 20,
    maxOrderStep: partial.maxOrderStep ?? 200000,
    oiLimitSteps: partial.oiLimitSteps ?? 2000000,
    impactBaseUsdc: partial.impactBaseUsdc ?? 50,
    impactBaseRaw,
    priceBandBps: partial.priceBandBps ?? 300,
    deployedAt: partial.deployedAt ?? 'live',
  }
}

const marketsByEnv: Record<EnvKey, Market[]> = {
  staging: [
    market({ id: 0, symbol: 'ETH', maxLeverage: 25, mmrPct: '2' }),
    market({ id: 1, symbol: 'BTC', maxLeverage: 25, mmrPct: '1.8' }),
    market({ id: 2, symbol: 'SOL', maxLeverage: 20, mmrPct: '2.5' }),
    market({ id: 3, symbol: 'ARB', status: 'locked' }),
    market({ id: 4, symbol: 'DOGE', deferredSettlement: true, stepSize: 10, stepPrice: 0.000001 }),
  ],
  testnet: [
    market({ id: 0, symbol: 'ETH', maxLeverage: 50 }),
    market({ id: 1, symbol: 'BTC', maxLeverage: 50 }),
    market({ id: 2, symbol: 'SOL', maxLeverage: 30 }),
    market({ id: 3, symbol: 'PEPE', stepSize: 1000, stepPrice: 0.00000001 }),
  ],
  mainnet: [
    market({ id: 0, symbol: 'ETH', maxLeverage: 25 }),
    market({ id: 1, symbol: 'BTC', maxLeverage: 25 }),
    market({ id: 2, symbol: 'SOL', maxLeverage: 20 }),
  ],
  shadow: [
    market({ id: 0, symbol: 'ETH', maxLeverage: 25 }),
    market({ id: 1, symbol: 'BTC', maxLeverage: 25 }),
    market({ id: 2, symbol: 'SOL', maxLeverage: 20 }),
  ],
}
