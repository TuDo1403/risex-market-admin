import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const readLiveMarkets = vi.fn()
const createMarketPublicClient = vi.fn(() => ({ readContract: vi.fn() }))
const quote = '0x0000000000000000000000000000000000000001'

vi.mock('@/src/lib/rpc/market-reader', () => ({
  createMarketPublicClient,
  readLiveMarkets,
}))

function request(url: string) {
  return new NextRequest(new Request(url))
}

describe('markets route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unknown environments', async () => {
    const { GET } = await import('./route')

    const response = await GET(request('http://localhost/api/markets?env=devnet'))

    expect(response.status).toBe(400)
  })

  it('reads live markets for the selected environment', async () => {
    readLiveMarkets.mockResolvedValueOnce([
      {
        id: 15,
        name: 'AERO/USD',
        quote,
        unlocked: true,
        maxLeverage: 3n,
        maintenanceMarginFactor: 4_500_000_000_000_000_000n,
        minOrderStep: 20n,
        maxOrderStep: 200_000n,
        oiLimitSteps: 2_000_000n,
        stepSize: 1_000_000_000_000_000_000n,
        stepPrice: 1_000n,
        matchPriceBandBps: 50n,
        impactNotionalBaseUsdc: 50n,
      },
    ])
    const { GET } = await import('./route')

    const response = await GET(request('http://localhost/api/markets?env=shadow'))
    const body = (await response.json()) as {
      env: string
      perps: string
      source: string
      markets: Array<{ symbol: string; quote: string; mmrRaw: string; impactBaseRaw: string }>
    }

    expect(response.status).toBe(200)
    expect(body.env).toBe('shadow')
    expect(body.perps).toBe('0x53f10fAcFC8965750494E6965F5d6dA39B41d852')
    expect(body.source).toBe('risex-contracts/script/data/mainnet/deployment.json')
    expect(body.markets).toEqual([
      expect.objectContaining({
        symbol: 'AERO',
        quote: 'USDC',
        mmrRaw: '4500000000000000000',
        impactBaseRaw: '50',
      }),
    ])
    expect(createMarketPublicClient).toHaveBeenCalledOnce()
    expect(readLiveMarkets).toHaveBeenCalledWith(
      expect.anything(),
      '0x53f10fAcFC8965750494E6965F5d6dA39B41d852',
      {
        multicall3Address: '0xcA11bde05977b3631167028862bE2a173976CA11',
        ordersManagerAddress: '0xE03C1D5081eb2d0E6bFd62A949C5b12eFa44F2cD',
      },
    )
  })
})
