import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { readLiveMarkets } from './market-reader'

const perps = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address
const quote = '0x0000000000000000000000000000000000000001' as Address

describe('live market reader', () => {
  it('enumerates markets from getTotalMarkets and then getMarketConfig(id)', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(2n)
    const multicall = vi.fn().mockResolvedValueOnce([
      {
        name: 'ETH/USD',
        quote,
        unlocked: true,
        maxLeverage: 10n,
        maintenanceMarginFactor: 1_000_000_000_000_000_000n,
        minOrderStep: 1n,
        maxOrderStep: 1_000n,
        oiLimitSteps: 10_000n,
        stepSize: 1_000_000_000_000_000_000n,
        stepPrice: 10_000n,
        matchPriceBandBps: 50n,
      },
      250n,
      false,
      {
        name: 'AERO/USD',
        quote,
        unlocked: true,
        maxLeverage: 3n,
        maintenanceMarginFactor: 4_500_000_000_000_000_000n,
        minOrderStep: 20n,
        maxOrderStep: 200_000n,
        oiLimitSteps: 2_000_000n,
        stepSize: 1n,
        stepPrice: 1_000n,
        matchPriceBandBps: 0n,
      },
      50n,
      true,
    ])

    const markets = await readLiveMarkets(
      { readContract, multicall },
      perps,
      {
        multicall3Address: '0xcA11bde05977b3631167028862bE2a173976CA11',
        ordersManagerAddress: '0xE03C1D5081eb2d0E6bFd62A949C5b12eFa44F2cD',
      },
    )

    expect(markets).toHaveLength(2)
    expect(markets[0]?.id).toBe(0)
    expect(markets[1]).toMatchObject({
      id: 1,
      name: 'AERO/USD',
      maxLeverage: 3n,
      maintenanceMarginFactor: 4_500_000_000_000_000_000n,
      impactNotionalBaseUsdc: 50n,
      deferredSettlement: true,
    })
    expect(readContract).toHaveBeenNthCalledWith(1, expect.objectContaining({ functionName: 'getTotalMarkets' }))
    expect(readContract).toHaveBeenCalledTimes(1)
    expect(multicall).toHaveBeenCalledOnce()
    expect(multicall).toHaveBeenCalledWith({
      allowFailure: false,
      multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
      contracts: [
        expect.objectContaining({ functionName: 'getMarketConfig', args: [0] }),
        expect.objectContaining({ functionName: 'getImpactNotionalBaseUsdc', args: [0] }),
        expect.objectContaining({ functionName: 'isDeferredMode', args: [perps, 0] }),
        expect.objectContaining({ functionName: 'getMarketConfig', args: [1] }),
        expect.objectContaining({ functionName: 'getImpactNotionalBaseUsdc', args: [1] }),
        expect.objectContaining({ functionName: 'isDeferredMode', args: [perps, 1] }),
      ],
    })
  })

  it('does not call multicall when there are no markets', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(0n)
    const multicall = vi.fn()

    await expect(readLiveMarkets({ readContract, multicall }, perps)).resolves.toEqual([])

    expect(multicall).not.toHaveBeenCalled()
  })
})
