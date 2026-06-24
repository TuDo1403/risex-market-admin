import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'
import type { Hex } from 'viem'

function normalizedPair(symbol: string): string {
  return `${symbol.trim().toUpperCase()}USDC`
}

export function deriveIndexPriceId(symbol: string): Hex {
  return `0x${bytesToHex(keccak_256(utf8ToBytes(normalizedPair(symbol))))}`
}

export function deriveMarkPriceId(symbol: string): Hex {
  return `0x${bytesToHex(keccak_256(utf8ToBytes(`${normalizedPair(symbol)}MARK`)))}`
}
