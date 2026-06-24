import type { Address, Hex } from 'viem'

import { risexOracleAbi, risexStorkAbi, storkAbi } from '@/src/lib/abis'
import { deriveIndexPriceId, deriveMarkPriceId } from '@/src/lib/price-ids'

export type OracleValidation = {
  marketId: number | null
  symbol: string
  expectedIndexPriceId: Hex
  expectedMarkPriceId: Hex
  actualIndexPriceId: Hex | null
  actualMarkPriceId: Hex | null
  indexPrice: string | null
  markPrice: string | null
  indexPriceIdMatches: boolean
  markPriceIdMatches: boolean
  indexPriceLive: boolean
  markPriceLive: boolean
}

type OracleValidationClient = {
  multicall(args: unknown): Promise<unknown>
  readContract?(args: unknown): Promise<unknown>
}

type SettledResult<T> =
  | { status: 'success'; result: T }
  | { status: 'failure'; error?: unknown }

export async function readOracleValidation(
  client: OracleValidationClient,
  addresses: { risexOracle: Address; risexStork: Address; multicall3?: Address },
  marketId: number,
  symbol: string,
): Promise<OracleValidation> {
  const expectedIndexPriceId = deriveIndexPriceId(symbol)
  const expectedMarkPriceId = deriveMarkPriceId(symbol)

  const [actualIndexPriceIdResult, actualMarkPriceIdResult, indexPriceResult, markPriceResult] = await client.multicall({
    allowFailure: true,
    multicallAddress: addresses.multicall3,
    contracts: [
      {
        address: addresses.risexStork,
        abi: risexStorkAbi,
        functionName: 'getIndexPriceId',
        args: [marketId],
      },
      {
        address: addresses.risexStork,
        abi: risexStorkAbi,
        functionName: 'getMarkPriceId',
        args: [marketId],
      },
      {
        address: addresses.risexOracle,
        abi: risexOracleAbi,
        functionName: 'getIndexPrice',
        args: [marketId],
      },
      {
        address: addresses.risexOracle,
        abi: risexOracleAbi,
        functionName: 'getMarkPrice',
        args: [marketId],
      },
    ],
  }) as [
    SettledResult<Hex>,
    SettledResult<Hex>,
    SettledResult<bigint>,
    SettledResult<bigint>,
  ]

  const actualIndexPriceId = actualIndexPriceIdResult.status === 'success' ? actualIndexPriceIdResult.result : null
  const actualMarkPriceId = actualMarkPriceIdResult.status === 'success' ? actualMarkPriceIdResult.result : null
  const indexPrice = indexPriceResult.status === 'success' ? indexPriceResult.result : null
  const markPrice = markPriceResult.status === 'success' ? markPriceResult.result : null

  return {
    marketId,
    symbol: symbol.trim().toUpperCase(),
    expectedIndexPriceId,
    expectedMarkPriceId,
    actualIndexPriceId,
    actualMarkPriceId,
    indexPrice: indexPrice?.toString() ?? null,
    markPrice: markPrice?.toString() ?? null,
    indexPriceIdMatches: actualIndexPriceId === expectedIndexPriceId,
    markPriceIdMatches: actualMarkPriceId === expectedMarkPriceId,
    indexPriceLive: indexPrice !== null && indexPrice > 0n,
    markPriceLive: markPrice !== null && markPrice > 0n,
  }
}

export async function readOpenOracleValidation(
  client: OracleValidationClient,
  addresses: { risexStork: Address; multicall3?: Address },
  symbol: string,
): Promise<OracleValidation> {
  if (!client.readContract) {
    throw new Error('open oracle validation requires readContract')
  }

  const expectedIndexPriceId = deriveIndexPriceId(symbol)
  const expectedMarkPriceId = deriveMarkPriceId(symbol)
  const stork = await client.readContract({
    address: addresses.risexStork,
    abi: risexStorkAbi,
    functionName: 'getStork',
  }) as Address

  const [indexPriceResult, markPriceResult] = await client.multicall({
    allowFailure: true,
    multicallAddress: addresses.multicall3,
    contracts: [
      {
        address: stork,
        abi: storkAbi,
        functionName: 'getTemporalNumericValueV1',
        args: [expectedIndexPriceId],
      },
      {
        address: stork,
        abi: storkAbi,
        functionName: 'getTemporalNumericValueV1',
        args: [expectedMarkPriceId],
      },
    ],
  }) as [
    SettledResult<{ timestampNs: bigint; quantizedValue: bigint }>,
    SettledResult<{ timestampNs: bigint; quantizedValue: bigint }>,
  ]

  const indexPrice = indexPriceResult.status === 'success' ? indexPriceResult.result.quantizedValue : null
  const markPrice = markPriceResult.status === 'success' ? markPriceResult.result.quantizedValue : null

  return {
    marketId: null,
    symbol: symbol.trim().toUpperCase(),
    expectedIndexPriceId,
    expectedMarkPriceId,
    actualIndexPriceId: expectedIndexPriceId,
    actualMarkPriceId: expectedMarkPriceId,
    indexPrice: indexPrice?.toString() ?? null,
    markPrice: markPrice?.toString() ?? null,
    indexPriceIdMatches: indexPrice !== null,
    markPriceIdMatches: markPrice !== null,
    indexPriceLive: indexPrice !== null && indexPrice > 0n,
    markPriceLive: markPrice !== null && markPrice > 0n,
  }
}
