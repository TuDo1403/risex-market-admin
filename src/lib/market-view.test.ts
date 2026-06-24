import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'

import { liveMarketToDisplayMarket } from './market-view'

const quote = '0x0000000000000000000000000000000000000001' as Address

describe('live market display adapter', () => {
  it('maps raw contract market config to exact table values', () => {
    const market = liveMarketToDisplayMarket({
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
      stepPrice: 10_000_000_000_000n,
      matchPriceBandBps: 50n,
      impactNotionalBaseUsdc: 50n,
      markOracleConfig: {
        timeConstantSeconds: 450n,
        minUpdateInterval: 10n,
        maxPremiumBps: 30n,
      },
    })

    expect(market).toMatchObject({
      id: 15,
      symbol: 'AERO',
      quote: 'USDC',
      status: 'unlocked',
      deferredSettlement: false,
      maxLeverage: 3,
      mmrPct: '22.222222222222222222',
      mmrRaw: '4500000000000000000',
      stepSize: '1',
      stepSizeRaw: '1000000000000000000',
      stepPrice: 0.00001,
      stepPriceRaw: '10000000000000',
      minOrderStep: 20,
      maxOrderStep: 200000,
      oiLimitSteps: 2000000,
      impactBaseUsdc: 50,
      impactBaseRaw: '50',
      priceBandBps: 50,
      markOracleTimeConstantSeconds: 450,
      markOracleMinUpdateInterval: 10,
      markOracleMaxPremiumBps: 30,
    })
  })

  it('marks locked markets from the contract unlocked flag', () => {
    const market = liveMarketToDisplayMarket({
      id: 1,
      name: 'ETH/USD',
      quote,
      unlocked: false,
      maxLeverage: 25n,
      maintenanceMarginFactor: 50_000_000_000_000_000_000n,
      minOrderStep: 1n,
      maxOrderStep: 500_000n,
      oiLimitSteps: 5_000_000n,
      stepSize: 1_000_000_000_000_000n,
      stepPrice: 1_000_000n,
      matchPriceBandBps: 150n,
      impactNotionalBaseUsdc: 250n,
    })

    expect(market.status).toBe('locked')
    expect(market.mmrRaw).toBe('50000000000000000000')
  })

  it('maps deferred settlement independently from market lock status', () => {
    const market = liveMarketToDisplayMarket({
      id: 2,
      name: 'ETH/USD',
      quote,
      unlocked: true,
      maxLeverage: 25n,
      maintenanceMarginFactor: 50_000_000_000_000_000_000n,
      minOrderStep: 1n,
      maxOrderStep: 500_000n,
      oiLimitSteps: 5_000_000n,
      stepSize: 1_000_000_000_000_000n,
      stepPrice: 1_000_000n,
      matchPriceBandBps: 150n,
      impactNotionalBaseUsdc: 250n,
      deferredSettlement: true,
    })

    expect(market.status).toBe('unlocked')
    expect(market.deferredSettlement).toBe(true)
  })

  it('keeps malformed zero-maintenance rows visible instead of throwing', () => {
    const market = liveMarketToDisplayMarket({
      id: 99,
      name: 'BROKEN/USD',
      quote,
      unlocked: false,
      maxLeverage: 0n,
      maintenanceMarginFactor: 0n,
      minOrderStep: 0n,
      maxOrderStep: 0n,
      oiLimitSteps: 0n,
      stepSize: 0n,
      stepPrice: 0n,
      matchPriceBandBps: 0n,
      impactNotionalBaseUsdc: 0n,
    })

    expect(market.status).toBe('locked')
    expect(market.mmrPct).toBe('0')
    expect(market.mmrRaw).toBe('0')
  })
})
