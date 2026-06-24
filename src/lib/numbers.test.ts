import { describe, expect, it } from 'vitest'

import {
  formatRawDecimal,
  maintenanceMarginFactorToMmrPercent,
  mmrPercentToMaintenanceMarginFactor,
  parseBps,
  parseDecimalToRaw,
  parseImpactBaseUsdc,
} from './numbers'

describe('exact numeric conversions', () => {
  it('parses decimal strings to raw bigint without floating point math', () => {
    expect(parseDecimalToRaw('1', 18)).toBe(1_000_000_000_000_000_000n)
    expect(parseDecimalToRaw('0.00001', 8)).toBe(1_000n)
    expect(parseDecimalToRaw('200000', 0)).toBe(200_000n)
  })

  it('rejects ambiguous decimals that cannot be represented exactly', () => {
    expect(() => parseDecimalToRaw('0.000000001', 8)).toThrow(/too many decimal places/)
    expect(() => parseDecimalToRaw('1.2.3', 18)).toThrow(/invalid decimal/)
    expect(() => parseDecimalToRaw('-1', 18)).toThrow(/non-negative/)
  })

  it('formats raw decimals without dropping significant integer precision', () => {
    expect(formatRawDecimal(4_500_000_000_000_000_000n, 18)).toBe('4.5')
    expect(formatRawDecimal(1_000n, 8)).toBe('0.00001')
    expect(formatRawDecimal(200_000n, 0)).toBe('200000')
  })

  it('converts MMR percent to maintenance margin factor exactly for the AERO listing', () => {
    expect(mmrPercentToMaintenanceMarginFactor('22.222222222222222222')).toBe(
      4_500_000_000_000_000_000n,
    )
  })

  it('converts maintenance margin factor back to a user-facing MMR percent', () => {
    expect(maintenanceMarginFactorToMmrPercent(4_500_000_000_000_000_000n, 18)).toBe(
      '22.222222222222222222',
    )
  })

  it('parses bps from bps or percent input labels', () => {
    expect(parseBps('2', 'bps')).toBe(2n)
    expect(parseBps('0.02', 'percent')).toBe(2n)
    expect(() => parseBps('0.2', 'bps')).toThrow(/integer bps/)
    expect(() => parseBps('0.25', 'bps')).toThrow(/integer bps/)
  })

  it('parses plain USDC impact base as uint64 whole-dollar value', () => {
    expect(parseImpactBaseUsdc('50')).toBe(50n)
    expect(parseImpactBaseUsdc('50.0')).toBe(50n)
    expect(() => parseImpactBaseUsdc('50.5')).toThrow(/whole USDC/)
    expect(() => parseImpactBaseUsdc('18446744073709551616')).toThrow(/uint64/)
  })
})
