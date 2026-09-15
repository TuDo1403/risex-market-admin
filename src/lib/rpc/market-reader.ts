import { createPublicClient, http, type Address, type PublicClient } from 'viem'

import type { DeploymentEnvironment } from '@/src/config/deployments'
import { ordersManagerAbi, perpsMarketConfigAbi, risexOracleAbi } from '@/src/lib/abis'

export type MarkOracleConfig = {
  timeConstantSeconds: bigint
  minUpdateInterval: bigint
  maxPremiumBps: bigint
}

export type PerpsMarketConfig = {
  name: string
  quote: Address
  unlocked: boolean
  maxLeverage: bigint
  maintenanceMarginFactor: bigint
  minOrderStep: bigint
  maxOrderStep: bigint
  oiLimitSteps: bigint
  stepSize: bigint
  stepPrice: bigint
  matchPriceBandBps: bigint
  impactNotionalBaseUsdc?: bigint
  deferredSettlement?: boolean
  markOracleConfig?: MarkOracleConfig
}

export type LiveMarket = PerpsMarketConfig & {
  id: number
}

type ReadContractClient = Pick<PublicClient, 'readContract'>
type MulticallClient = ReadContractClient & Pick<PublicClient, 'multicall'>

type ReadLiveMarketsOptions = {
  multicall3Address?: Address
  ordersManagerAddress?: Address
  risexOracleAddress?: Address
}

export async function readLiveMarkets(
  client: MulticallClient,
  perpsAddress: Address,
  options: ReadLiveMarketsOptions = {},
): Promise<LiveMarket[]> {
  const totalMarkets = Number(
    await client.readContract({
      address: perpsAddress,
      abi: perpsMarketConfigAbi,
      functionName: 'getTotalMarkets',
    }),
  )

  if (totalMarkets === 0) {
    return []
  }

  const marketIds = Array.from({ length: totalMarkets }, (_, index) => index + 1)

  const contracts = marketIds.map((id) => {
    const baseContracts = [
      {
        address: perpsAddress,
        abi: perpsMarketConfigAbi,
        functionName: 'getMarketConfig',
        args: [id],
      },
      {
        address: perpsAddress,
        abi: perpsMarketConfigAbi,
        functionName: 'getImpactNotionalBaseUsdc',
        args: [id],
      },
    ]

    if (!options.ordersManagerAddress) {
      return options.risexOracleAddress
        ? [
            ...baseContracts,
            {
              address: options.risexOracleAddress,
              abi: risexOracleAbi,
              functionName: 'getMarkOracleConfig',
              args: [id],
            },
          ]
        : baseContracts
    }

    return [
      ...baseContracts,
      {
        address: options.ordersManagerAddress,
        abi: ordersManagerAbi,
        functionName: 'isDeferredMode',
        args: [perpsAddress, id],
      },
      ...(options.risexOracleAddress
        ? [
            {
              address: options.risexOracleAddress,
              abi: risexOracleAbi,
              functionName: 'getMarkOracleConfig',
              args: [id],
            },
          ]
        : []),
    ]
  }).flat()

  // allowFailure: older deployments (RISE testnet/mainnet today) lack isDeferredMode
  // and getMarkOracleConfig; a single revert must not blank the whole market list.
  const results = await client.multicall({
    contracts,
    allowFailure: true,
    multicallAddress: options.multicall3Address,
  })

  const resultWidth = 2 + (options.ordersManagerAddress ? 1 : 0) + (options.risexOracleAddress ? 1 : 0)

  return marketIds.map((id, index) => {
    const offset = index * resultWidth
    let resultIndex = offset
    const config = unwrap(results[offset])
    resultIndex += 1
    const impactNotionalBaseUsdc = unwrap(results[resultIndex]) as bigint | number | string | undefined
    resultIndex += 1
    const deferred = options.ordersManagerAddress ? unwrap(results[resultIndex++]) : undefined
    const markOracle = options.risexOracleAddress ? unwrap(results[resultIndex]) : undefined

    if (config === undefined) {
      throw new Error(`failed to read market config for market ${id}`)
    }

    return {
      id,
      ...normalizeMarketConfig(config),
      impactNotionalBaseUsdc: impactNotionalBaseUsdc === undefined ? undefined : BigInt(impactNotionalBaseUsdc),
      deferredSettlement: deferred === undefined ? undefined : Boolean(deferred),
      markOracleConfig: markOracle === undefined ? undefined : normalizeMarkOracleConfig(markOracle),
    }
  })
}

// multicall(allowFailure: true) yields { status: 'success', result } | { status: 'failure', error }
function unwrap(result: unknown): unknown {
  const entry = result as { status: 'success' | 'failure'; result?: unknown } | undefined
  return entry?.status === 'success' ? entry.result : undefined
}

export function createMarketPublicClient(env: DeploymentEnvironment): PublicClient {
  return createPublicClient({
    transport: http(env.rpcUrl),
  })
}

function normalizeMarketConfig(config: unknown): PerpsMarketConfig {
  const value = config as PerpsMarketConfig
  return {
    name: value.name,
    quote: value.quote,
    unlocked: value.unlocked,
    maxLeverage: BigInt(value.maxLeverage),
    maintenanceMarginFactor: BigInt(value.maintenanceMarginFactor),
    minOrderStep: BigInt(value.minOrderStep),
    maxOrderStep: BigInt(value.maxOrderStep),
    oiLimitSteps: BigInt(value.oiLimitSteps),
    stepSize: BigInt(value.stepSize),
    stepPrice: BigInt(value.stepPrice),
    matchPriceBandBps: BigInt(value.matchPriceBandBps),
  }
}

function normalizeMarkOracleConfig(config: unknown): MarkOracleConfig {
  const value = config as MarkOracleConfig
  return {
    timeConstantSeconds: BigInt(value.timeConstantSeconds),
    minUpdateInterval: BigInt(value.minUpdateInterval),
    maxPremiumBps: BigInt(value.maxPremiumBps),
  }
}
