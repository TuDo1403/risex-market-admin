import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MarketAdminConsole } from './market-admin-console'
import { rawMmr, type EnvKey, type Market } from '@/src/lib/lovable-risex'
import { deriveIndexPriceId, deriveMarkPriceId } from '@/src/lib/price-ids'

const hookState = vi.hoisted(() => ({
  address: null as string | null,
  connector: { id: 'mock', name: 'Mock connector', type: 'mock' },
  sendTransaction: vi.fn(),
  sendTransactionAsync: vi.fn(),
  switchChainAsync: vi.fn(),
  chainId: 1,
}))

const rpcMocks = vi.hoisted(() => ({
  readLiveMarkets: vi.fn(),
  readOracleValidation: vi.fn(),
  readOpenOracleValidation: vi.fn(),
}))

const shadowMocks = vi.hoisted(() => ({
  createShadowWalletClient: vi.fn(),
  executeShadowPreflight: vi.fn(),
}))

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: hookState.address,
    isConnected: hookState.address !== null,
  }),
  useChainId: () => hookState.chainId,
  useConnect: () => ({
    connectors: [hookState.connector],
    connect: vi.fn(),
  }),
  useDisconnect: () => ({
    disconnect: vi.fn(() => {
      hookState.address = null
    }),
  }),
  useSendTransaction: () => ({
    sendTransaction: hookState.sendTransaction,
    sendTransactionAsync: hookState.sendTransactionAsync,
    isPending: false,
  }),
  useSwitchChain: () => ({
    switchChainAsync: hookState.switchChainAsync,
  }),
}))

vi.mock('@/src/lib/client/public-client', () => ({
  getPublicClient: vi.fn((env: EnvKey) => env),
}))

vi.mock('@/src/lib/market-view', () => ({
  liveMarketToDisplayMarket: (market: Market) => market,
}))

vi.mock('@/src/lib/rpc/market-reader', () => ({
  readLiveMarkets: rpcMocks.readLiveMarkets,
}))

vi.mock('@/src/lib/rpc/oracle-validation', () => ({
  readOpenOracleValidation: rpcMocks.readOpenOracleValidation,
  readOracleValidation: rpcMocks.readOracleValidation,
}))

vi.mock('@/src/lib/shadow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/shadow')>()
  return {
    ...actual,
    createShadowWalletClient: shadowMocks.createShadowWalletClient,
    executeShadowPreflight: shadowMocks.executeShadowPreflight,
  }
})

function textIncludes(value: string) {
  return (_content: string, node: Element | null) => node?.textContent?.includes(value) ?? false
}

describe('MarketAdminConsole Lovable source port', () => {
  beforeEach(() => {
    hookState.address = null
    hookState.chainId = 1
    hookState.sendTransaction.mockReset()
    hookState.sendTransactionAsync.mockReset()
    hookState.sendTransactionAsync.mockResolvedValue('0xabc')
    hookState.switchChainAsync.mockReset()
    hookState.switchChainAsync.mockImplementation(async ({ chainId }: { chainId: number }) => {
      hookState.chainId = chainId
    })
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'passed',
          txHashes: ['0xabc'],
          preTotalMarkets: 3,
          postTotalMarkets: 4,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'ethereum', {
      value: { request: vi.fn() },
      configurable: true,
    })
    shadowMocks.createShadowWalletClient.mockReset()
    shadowMocks.createShadowWalletClient.mockResolvedValue({ shadowClient: true })
    shadowMocks.executeShadowPreflight.mockReset()
    shadowMocks.executeShadowPreflight.mockResolvedValue({
      status: 'passed',
      txHashes: ['0xabc'],
      preTotalMarkets: 3,
      postTotalMarkets: 4,
    })
    rpcMocks.readLiveMarkets.mockImplementation(async (env: EnvKey) => marketsByEnv[env])
    const validate = async (_client: unknown, _addresses: unknown, marketIdOrSymbol: number | string, maybeSymbol?: string) => {
      const symbol = typeof marketIdOrSymbol === 'string' ? marketIdOrSymbol : maybeSymbol ?? 'DOGE'
      return {
        marketId: typeof marketIdOrSymbol === 'number' ? marketIdOrSymbol : null,
        symbol,
        expectedIndexPriceId: deriveIndexPriceId(symbol),
        expectedMarkPriceId: deriveMarkPriceId(symbol),
        actualIndexPriceId: deriveIndexPriceId(symbol),
        actualMarkPriceId: deriveMarkPriceId(symbol),
        indexPrice: '100000000',
        markPrice: '100100000',
        indexPriceIdMatches: true,
        markPriceIdMatches: true,
        indexPriceLive: true,
        markPriceLive: true,
      }
    }
    rpcMocks.readOracleValidation.mockImplementation(validate)
    rpcMocks.readOpenOracleValidation.mockImplementation(validate)
  })

  afterEach(() => {
    vi.clearAllMocks()
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

    expect(screen.getByText(/Update Market.*#5 DOGE\/USDC/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Step size/i)).toHaveValue('10')
    expect(screen.getByLabelText(/Step size/i)).toBeDisabled()
    expect(screen.getByLabelText(/Step price/i)).toHaveValue(0.000001)
    expect(screen.getByLabelText(/Step price/i)).toBeDisabled()
    expect(screen.getAllByText(/immutable after open/i).length).toBeGreaterThan(0)
    expect(screen.getByText('loaded')).toBeInTheDocument()
    expect(screen.getByText(/Before \/ After/i)).toBeInTheDocument()
    expect(screen.queryByText(/updateMarketConfig/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/stepSize=/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/stepPrice=/i)).not.toBeInTheDocument()
    expect(await screen.findByText(/index 100000000 · mark 100100000/i)).toBeInTheDocument()
  })

  it('does not chain updateMarketConfig for mark-oracle-only updates', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="staging" />)

    await user.dblClick(await screen.findByText('DOGE/USDC'))
    await user.clear(screen.getByLabelText(/Mark max/i))
    await user.type(screen.getByLabelText(/Mark max/i), '75')

    expect(screen.queryByText(/updateMarketConfig/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/configureMarkOracle/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/maxPremium=75bps/i)).toBeInTheDocument()
  })

  it('uses only updateMarketConfig for price-band-only updates', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="staging" />)

    await user.dblClick(await screen.findByText('DOGE/USDC'))
    await user.clear(screen.getByLabelText(/Match price band/i))
    await user.type(screen.getByLabelText(/Match price band/i), '5')

    expect(screen.getAllByText(/updateMarketConfig/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/configureMarkOracle/i)).not.toBeInTheDocument()
    expect(screen.getByText(/priceBand=5% \(50000 raw\)/i)).toBeInTheDocument()
  })

  it('explains how to fill friendly values while showing raw conversions', async () => {
    const user = userEvent.setup()
    render(<MarketAdminConsole initialEnv="staging" />)

    await user.click(screen.getByRole('button', { name: /open market/i }))
    await user.click(screen.getByRole('button', { name: /AERO\/USDC example/i }))

    expect(screen.getByLabelText(/Market name/i)).toHaveValue('AERO')
    expect(screen.getByLabelText(/Quote/i)).toHaveTextContent('USDC')
    expect(screen.getByLabelText(/Step size/i)).toHaveValue('1')
    expect(screen.getByLabelText(/Step price/i)).toHaveValue(0.00001)
    expect(screen.getAllByText(textIncludes('raw: 1000000000000000000')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(textIncludes('raw: 1000')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(textIncludes('raw: 50')).length).toBeGreaterThan(0)
    expect(screen.getByText(/stored uint64; effective = base × 1e18 × maxLev/i)).toBeInTheDocument()
    expect(screen.getByText(/5% = 50000 raw/i)).toBeInTheDocument()
    expect(screen.getAllByText(textIncludes('raw: 300 raw')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/setDeferredMode/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/configureMarkOracle/i).length).toBeGreaterThan(0)
    expect(await screen.findByText(/index 100000000 · mark 100100000/i)).toBeInTheDocument()
    expect(rpcMocks.readOpenOracleValidation).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'AERO',
    )
    expect(screen.getByText('FRIENDLY')).toBeInTheDocument()
    expect(screen.getByText('RAW')).toBeInTheDocument()
  })

  it('uses one atomic execution path across environments', async () => {
    const user = userEvent.setup()
    hookState.address = '0x7CD9460423f9f1751B1F7F1581Aa74d7e4b0984D'
    const view = render(<MarketAdminConsole initialEnv="mainnet" />)

    await user.click(screen.getByRole('button', { name: /open market/i }))
    await user.click(screen.getByRole('button', { name: /AERO\/USDC example/i }))
    expect(screen.getAllByText(/AccessManager\.multicall/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/configureMarkOracle/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /send wallet tx/i })).toBeDisabled()
    expect(screen.getByText(/run shadow first/i)).toBeInTheDocument()
    const runShadow = screen.getByRole('button', { name: /run on shadow/i })
    expect(runShadow).toBeEnabled()
    expect(hookState.switchChainAsync).not.toHaveBeenCalled()
    expect(hookState.sendTransactionAsync).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /send wallet tx/i })).toBeDisabled()

    await user.click(within(screen.getByRole('group', { name: /environment/i })).getByRole('button', { name: /environment mainnet/i }))
    await user.click(screen.getByRole('button', { name: /staging/i }))
    expect(screen.getByText(/Atomic transaction JSON/i)).toBeInTheDocument()
    expect(screen.queryByText(/Shadow preflight/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send wallet tx/i })).toBeEnabled()
    view.rerender(<MarketAdminConsole initialEnv="mainnet" />)
  })

  it('shows shadow preflight only for mainnet submissions', async () => {
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
  const mmrRaw = partial.mmrRaw ?? rawMmr(partial.mmrPct ?? '5.0')
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
    markOracleTimeConstantSeconds: partial.markOracleTimeConstantSeconds ?? 480,
    markOracleMinUpdateInterval: partial.markOracleMinUpdateInterval ?? 10,
    markOracleMaxPremiumBps: partial.markOracleMaxPremiumBps ?? 50,
    deployedAt: partial.deployedAt ?? 'live',
  }
}

const marketsByEnv: Record<EnvKey, Market[]> = {
  staging: [
    market({ id: 1, symbol: 'ETH', maxLeverage: 25, mmrPct: '2' }),
    market({ id: 2, symbol: 'BTC', maxLeverage: 25, mmrPct: '1.8' }),
    market({ id: 3, symbol: 'SOL', maxLeverage: 20, mmrPct: '2.5' }),
    market({ id: 4, symbol: 'ARB', status: 'locked' }),
    market({ id: 5, symbol: 'DOGE', quote: 'USDT', deferredSettlement: true, stepSize: 10, stepPrice: 0.000001 }),
  ],
  testnet: [
    market({ id: 1, symbol: 'ETH', maxLeverage: 50 }),
    market({ id: 2, symbol: 'BTC', maxLeverage: 50 }),
    market({ id: 3, symbol: 'SOL', maxLeverage: 30 }),
    market({ id: 4, symbol: 'PEPE', stepSize: 1000, stepPrice: 0.00000001 }),
  ],
  mainnet: [
    market({ id: 1, symbol: 'ETH', maxLeverage: 25 }),
    market({ id: 2, symbol: 'BTC', maxLeverage: 25 }),
    market({ id: 3, symbol: 'SOL', maxLeverage: 20 }),
  ],
  shadow: [
    market({ id: 1, symbol: 'ETH', maxLeverage: 25 }),
    market({ id: 2, symbol: 'BTC', maxLeverage: 25 }),
    market({ id: 3, symbol: 'SOL', maxLeverage: 20 }),
  ],
}
