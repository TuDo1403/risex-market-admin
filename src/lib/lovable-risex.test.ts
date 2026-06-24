import { describe, expect, it } from 'vitest'

import { priceBandBpsToPercent, rawPriceBandBps } from './lovable-risex'

describe('RISEx market display conversions', () => {
  it('converts match price band using the RISEx 1e6 denominator', () => {
    expect(priceBandBpsToPercent(50_000)).toBe('5')
    expect(priceBandBpsToPercent(300)).toBe('0.03')
    expect(priceBandBpsToPercent(1_000_000)).toBe('100')

    expect(rawPriceBandBps('5')).toBe('50000')
    expect(rawPriceBandBps('0.03')).toBe('300')
    expect(rawPriceBandBps('100')).toBe('1000000')
  })
})
