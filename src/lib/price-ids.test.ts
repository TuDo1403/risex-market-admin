// src/lib/price-ids.test.ts
import { describe, expect, it } from 'vitest'
import { deriveIndexPriceId, deriveMarkPriceId } from './price-ids'

describe('price id derivation', () => {
  it('matches the on-chain BTC golden vectors from config/testnet.toml', () => {
    expect(deriveIndexPriceId('BTC')).toBe('0x7321ce442e8814b638e0cd241a8838e7d8222a43cbaaca78adcc2337bfa3185d')
    expect(deriveMarkPriceId('BTC')).toBe('0x98848cd117152974f79fb357720f794415ab653bc2c2dd4548395dc2c4123440')
  })

  it('uppercases the symbol', () => {
    expect(deriveIndexPriceId('btc')).toBe(deriveIndexPriceId('BTC'))
  })
})
