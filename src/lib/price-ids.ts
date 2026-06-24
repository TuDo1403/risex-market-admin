import { keccak256, toHex, type Hex } from 'viem'

import { QUOTE_SYMBOL } from './lovable-risex'

function normalizedPair(symbol: string): string {
  return `${symbol.trim().toUpperCase()}${QUOTE_SYMBOL}`
}

export function deriveIndexPriceId(symbol: string): Hex {
  return keccak256(toHex(normalizedPair(symbol)))
}

export function deriveMarkPriceId(symbol: string): Hex {
  return keccak256(toHex(`${normalizedPair(symbol)}MARK`))
}
