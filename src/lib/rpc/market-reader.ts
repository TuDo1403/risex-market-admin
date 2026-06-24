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

  const results = await client.multicall({
    contracts,
    allowFailure: false,
    multicallAddress: options.multicall3Address,
  })

  const resultWidth = 2 + (options.ordersManagerAddress ? 1 : 0) + (options.risexOracleAddress ? 1 : 0)

  return marketIds.map((id, index) => {
    const offset = index * resultWidth
    let resultIndex = offset
    const config = results[offset]
    resultIndex += 1
    const impactNotionalBaseUsdc = results[resultIndex] as bigint | number | string
    resultIndex += 1
    const deferredSettlement = options.ordersManagerAddress ? Boolean(results[resultIndex++]) : false
    const markOracleConfig = options.risexOracleAddress ? normalizeMarkOracleConfig(results[resultIndex]) : undefined

    return {
      id,
      ...normalizeMarketConfig(config),
      impactNotionalBaseUsdc: BigInt(impactNotionalBaseUsdc),
      deferredSettlement,
      markOracleConfig,
    }
  })
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
