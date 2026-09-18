import { describe, expect, it } from 'vitest'

import { rawMmr, mmrFromRaw, mmrRatioPct, priceBandBpsToPercent, rawPriceBandBps } from './market-domain'

describe('RISEx market display conversions', () => {
  it('converts match price band using the RISEx 1e6 denominator', () => {
    expect(priceBandBpsToPercent(50_000)).toBe('5')
    expect(priceBandBpsToPercent(300)).toBe('0.03')
    expect(priceBandBpsToPercent(1_000_000)).toBe('100')

    expect(rawPriceBandBps('5')).toBe('50000')
    expect(rawPriceBandBps('0.03')).toBe('300')
    expect(rawPriceBandBps('100')).toBe('1000000')
  })

  it('round-trips the on-chain maintenance margin and derives the ratio for reference', () => {
    expect(rawMmr('4.5')).toBe('4500000000000000000')
    expect(mmrFromRaw('4500000000000000000')).toBe('4.5')
    expect(mmrRatioPct('4500000000000000000')).toBe('22.222222222222222222')

    expect(rawMmr(mmrFromRaw('15000000000000000000'))).toBe('15000000000000000000')
    expect(mmrRatioPct('50000000000000000000')).toBe('2')
    expect(mmrRatioPct('0')).toBe('—')
  })
})
