import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMarketPublicClient = vi.fn(() => ({ multicall: vi.fn() }))
const readOracleValidation = vi.fn()

vi.mock('@/src/lib/rpc/market-reader', () => ({
  createMarketPublicClient,
}))

vi.mock('@/src/lib/rpc/oracle-validation', () => ({
  readOracleValidation,
}))

function request(url: string) {
  return new NextRequest(new Request(url))
}

describe('oracle validation route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid request params', async () => {
    const { GET } = await import('./route')

    expect((await GET(request('http://localhost/api/oracle/validation?env=devnet&marketId=1&symbol=BTC'))).status).toBe(400)
    expect((await GET(request('http://localhost/api/oracle/validation?env=staging&marketId=bad&symbol=BTC'))).status).toBe(400)
    expect((await GET(request('http://localhost/api/oracle/validation?env=staging&marketId=1'))).status).toBe(400)
  })

  it('reads oracle price ids and prices for the selected market', async () => {
    readOracleValidation.mockResolvedValueOnce({
      marketId: 4,
      symbol: 'DOGE',
      expectedIndexPriceId: '0x01',
      expectedMarkPriceId: '0x02',
      actualIndexPriceId: '0x01',
      actualMarkPriceId: '0x02',
      indexPrice: '100000000',
      markPrice: '100100000',
      indexPriceIdMatches: true,
      markPriceIdMatches: true,
      indexPriceLive: true,
      markPriceLive: true,
    })
    const { GET } = await import('./route')

    const response = await GET(request('http://localhost/api/oracle/validation?env=staging&marketId=4&symbol=DOGE'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.validation.symbol).toBe('DOGE')
    expect(readOracleValidation).toHaveBeenCalledWith(
      expect.anything(),
      {
        risexOracle: '0xb0A9a42E5cd3CA48C1f288CB0B427f41f3ab4885',
        risexStork: '0xc5e5C5994183E82Fa379d18EeE73F3f998d2E633',
        multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
      },
      4,
      'DOGE',
    )
  })
})
