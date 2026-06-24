import { keccak256, toHex, type Hex } from 'viem'

function normalizedPair(symbol: string): string {
  return `${symbol.trim().toUpperCase()}USDC`
}

export function deriveIndexPriceId(symbol: string): Hex {
  return keccak256(toHex(normalizedPair(symbol)))
}

export function deriveMarkPriceId(symbol: string): Hex {
  return keccak256(toHex(`${normalizedPair(symbol)}MARK`))
}
