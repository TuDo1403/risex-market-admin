import { encodeFunctionData, type Address, type Hex } from 'viem'

import { accessManagerAbi, perpsMarketConfigAbi } from './abis'
import type { PerpsMarketConfig } from './rpc/market-reader'

export type OrdersBookConfig = {
  stepSize: bigint
  stepPrice: bigint
}

export type InnerCall = {
  to: Address
  value: '0'
  data: Hex
  functionName: string
}

export type AtomicAccessManagerTx = {
  to: Address
  value: '0'
  data: Hex
  functionName: 'AccessManager.multicall'
  innerCalls: InnerCall[]
}

export type OpenMarketProposalInput = {
  accessManagerAddress: Address
  perpsAddress: Address
  nextMarketId: number
  perpsConfig: PerpsMarketConfig
  bookConfig: OrdersBookConfig
  markPriceId: Hex
  indexPriceId: Hex
  deferredMode?: boolean
  impactNotionalBaseUsdc?: bigint
}

export type UpdateMarketProposalInput = {
  accessManagerAddress: Address
  perpsAddress: Address
  marketId: number
  perpsConfig: PerpsMarketConfig
  lock?: boolean
  deferredMode?: boolean
  impactNotionalBaseUsdc?: bigint
}

export type MarketProposal = {
  innerCalls: InnerCall[]
  transaction: AtomicAccessManagerTx
}

function encodePerpsMarketConfig(config: PerpsMarketConfig) {
  return {
    ...config,
    maxLeverage: Number(config.maxLeverage),
    minOrderStep: Number(config.minOrderStep),
    maxOrderStep: Number(config.maxOrderStep),
    oiLimitSteps: Number(config.oiLimitSteps),
    matchPriceBandBps: Number(config.matchPriceBandBps),
  }
}

export function buildOpenMarketProposal(input: OpenMarketProposalInput): MarketProposal {
  const innerCalls: InnerCall[] = [
    {
      to: input.perpsAddress,
      value: '0',
      functionName: 'openMarket',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'openMarket',
        args: [
          {
            perpsConfig: encodePerpsMarketConfig(input.perpsConfig),
            bookConfig: input.bookConfig,
            markPriceId: input.markPriceId,
            indexPriceId: input.indexPriceId,
          },
        ],
      }),
    },
  ]

  if (input.deferredMode) {
    innerCalls.push({
      to: input.perpsAddress,
      value: '0',
      functionName: 'setDeferredMode',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'setDeferredMode',
        args: [input.nextMarketId, true],
      }),
    })
  }

  if (input.impactNotionalBaseUsdc !== undefined) {
    innerCalls.push({
      to: input.perpsAddress,
      value: '0',
      functionName: 'setImpactNotionalBaseUsdc',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'setImpactNotionalBaseUsdc',
        args: [input.nextMarketId, input.impactNotionalBaseUsdc],
      }),
    })
  }

  return {
    innerCalls,
    transaction: buildAtomicAccessManagerTx(input.accessManagerAddress, innerCalls),
  }
}

export function buildUpdateMarketProposal(input: UpdateMarketProposalInput): MarketProposal {
  const innerCalls: InnerCall[] = [
    {
      to: input.perpsAddress,
      value: '0',
      functionName: 'updateMarketConfig',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'updateMarketConfig',
        args: [input.marketId, encodePerpsMarketConfig(input.perpsConfig)],
      }),
    },
  ]

  if (input.lock !== undefined) {
    innerCalls.push({
      to: input.perpsAddress,
      value: '0',
      functionName: 'setMarketLock',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'setMarketLock',
        args: [input.marketId, !input.lock],
      }),
    })
  }

  if (input.deferredMode !== undefined) {
    innerCalls.push({
      to: input.perpsAddress,
      value: '0',
      functionName: 'setDeferredMode',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'setDeferredMode',
        args: [input.marketId, input.deferredMode],
      }),
    })
  }

  if (input.impactNotionalBaseUsdc !== undefined) {
    innerCalls.push({
      to: input.perpsAddress,
      value: '0',
      functionName: 'setImpactNotionalBaseUsdc',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'setImpactNotionalBaseUsdc',
        args: [input.marketId, input.impactNotionalBaseUsdc],
      }),
    })
  }

  return {
    innerCalls,
    transaction: buildAtomicAccessManagerTx(input.accessManagerAddress, innerCalls),
  }
}

export function buildAccessManagerExecuteCalldata(call: InnerCall): Hex {
  return encodeFunctionData({
    abi: accessManagerAbi,
    functionName: 'execute',
    args: [call.to, call.data],
  })
}

export function buildAtomicAccessManagerTx(
  accessManagerAddress: Address,
  innerCalls: InnerCall[],
): AtomicAccessManagerTx {
  return {
    to: accessManagerAddress,
    value: '0',
    functionName: 'AccessManager.multicall',
    innerCalls,
    data: encodeFunctionData({
      abi: accessManagerAbi,
      functionName: 'multicall',
      args: [innerCalls.map(buildAccessManagerExecuteCalldata)],
    }),
  }
}
