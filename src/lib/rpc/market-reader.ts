import { createPublicClient, http, type Address, type PublicClient } from 'viem'

import type { DeploymentEnvironment } from '@/src/config/deployments'
import { ordersManagerAbi, perpsMarketConfigAbi } from '@/src/lib/abis'

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
}

export type LiveMarket = PerpsMarketConfig & {
  id: number
}

type ReadContractClient = Pick<PublicClient, 'readContract'>
type MulticallClient = ReadContractClient & Pick<PublicClient, 'multicall'>

type ReadLiveMarketsOptions = {
  multicall3Address?: Address
  ordersManagerAddress?: Address
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

  const contracts = Array.from({ length: totalMarkets }, (_, id) => {
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
      return baseContracts
    }

    return [
      ...baseContracts,
      {
        address: options.ordersManagerAddress,
        abi: ordersManagerAbi,
        functionName: 'isDeferredMode',
        args: [perpsAddress, id],
      },
    ]
  }).flat()

  const results = await client.multicall({
    contracts,
    allowFailure: false,
    multicallAddress: options.multicall3Address,
  })

  const resultWidth = options.ordersManagerAddress ? 3 : 2

  return Array.from({ length: totalMarkets }, (_, id) => {
    const offset = id * resultWidth
    const config = results[offset]
    const impactNotionalBaseUsdc = results[offset + 1] as bigint | number | string
    const deferredSettlement = options.ordersManagerAddress ? Boolean(results[offset + 2]) : false

    return {
      id,
      ...normalizeMarketConfig(config),
      impactNotionalBaseUsdc: BigInt(impactNotionalBaseUsdc),
      deferredSettlement,
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
