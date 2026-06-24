import { keccak256, stringToHex, type Hex } from 'viem'

// Mirrors the Solidity derivation in risex-contracts:
//   indexPriceId = keccak256(bytes(string.concat(symbol, "USDC")))
//   markPriceId  = keccak256(bytes(string.concat(symbol, "USDCMARK")))
export function deriveIndexPriceId(baseSymbol: string): Hex {
  return keccak256(stringToHex(`${baseSymbol.toUpperCase()}USDC`))
}

export function deriveMarkPriceId(baseSymbol: string): Hex {
  return keccak256(stringToHex(`${baseSymbol.toUpperCase()}USDCMARK`))
}
