import { describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'

import { deriveIndexPriceId, deriveMarkPriceId } from '@/src/lib/price-ids'
import { readOracleValidation } from './oracle-validation'

const risexOracle = '0x0000000000000000000000000000000000000001' as Address
const risexStork = '0x0000000000000000000000000000000000000002' as Address
const multicall3 = '0x0000000000000000000000000000000000000003' as Address

describe('oracle validation reader', () => {
  it('checks configured price ids and live index/mark prices', async () => {
    const client = {
      multicall: vi.fn(async () => [
        { status: 'success', result: deriveIndexPriceId('BTC') },
        { status: 'success', result: deriveMarkPriceId('BTC') },
        { status: 'success', result: 100_000_000_000n },
        { status: 'success', result: 100_100_000_000n },
      ]),
    }

    const validation = await readOracleValidation(client, { risexOracle, risexStork, multicall3 }, 1, 'btc')

    expect(client.multicall).toHaveBeenCalledWith(expect.objectContaining({ multicallAddress: multicall3 }))
    expect(validation).toMatchObject({
      marketId: 1,
      symbol: 'BTC',
      indexPriceIdMatches: true,
      markPriceIdMatches: true,
      indexPriceLive: true,
      markPriceLive: true,
      indexPrice: '100000000000',
      markPrice: '100100000000',
    })
  })

  it('marks stale or misconfigured oracle data as failed validation', async () => {
    const client = {
      multicall: async () => [
        { status: 'success', result: deriveIndexPriceId('ETH') },
        { status: 'success', result: deriveMarkPriceId('ETH') },
        { status: 'failure' },
        { status: 'success', result: 0n },
      ],
    }

    const validation = await readOracleValidation(client, { risexOracle, risexStork }, 1, 'BTC')

    expect(validation.indexPriceIdMatches).toBe(false)
    expect(validation.markPriceIdMatches).toBe(false)
    expect(validation.indexPriceLive).toBe(false)
    expect(validation.markPriceLive).toBe(false)
  })
})
