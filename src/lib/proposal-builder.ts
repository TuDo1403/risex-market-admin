import {
  concatHex,
  encodeFunctionData,
  numberToHex,
  pad,
  size,
  type Address,
  type Hex,
} from 'viem'

import { multiSendAbi, perpsMarketConfigAbi } from './abis'
import type { PerpsMarketConfig } from './rpc/market-reader'

export const MULTISEND_CALL_ONLY = '0x9641d764fc13c8B624c04430C7356C1C7C8102e2' as Address

export type OrdersBookConfig = {
  base: Address
  quote: Address
  pricePrecision: number
  sizePrecision: number
  tickSize: bigint
  minSize: bigint
  maxSize: bigint
}

export type InnerCall = {
  to: Address
  value: '0'
  data: Hex
  operation: 0
  functionName: string
}

export type SafeTxJson = {
  to: Address
  value: '0'
  data: Hex
  operation: 1
  baseGas: '0'
  gasPrice: '0'
  gasToken: Address
  refundReceiver: Address
  safeTxGas: '0'
}

export type OpenMarketProposalInput = {
  perpsAddress: Address
  nextMarketId: number
  perpsConfig: PerpsMarketConfig
  bookConfig: OrdersBookConfig
  markPriceId: Hex
  indexPriceId: Hex
  deferredMode?: boolean
  impactNotionalBaseUsdc?: bigint
}

export type OpenMarketProposal = {
  innerCalls: InnerCall[]
  multiSendPayload: Hex
  safeTx: SafeTxJson
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

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

export function buildOpenMarketProposal(input: OpenMarketProposalInput): OpenMarketProposal {
  const innerCalls: InnerCall[] = [
    {
      to: input.perpsAddress,
      value: '0',
      operation: 0,
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
      operation: 0,
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
      operation: 0,
      functionName: 'setImpactNotionalBaseUsdc',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi,
        functionName: 'setImpactNotionalBaseUsdc',
        args: [input.nextMarketId, input.impactNotionalBaseUsdc],
      }),
    })
  }

  const packedTransactions = encodeMultiSendTransactions(innerCalls)
  const multiSendPayload = encodeFunctionData({
    abi: multiSendAbi,
    functionName: 'multiSend',
    args: [packedTransactions],
  })

  return {
    innerCalls,
    multiSendPayload,
    safeTx: {
      to: MULTISEND_CALL_ONLY,
      value: '0',
      data: multiSendPayload,
      operation: 1,
      baseGas: '0',
      gasPrice: '0',
      gasToken: ZERO_ADDRESS,
      refundReceiver: ZERO_ADDRESS,
      safeTxGas: '0',
    },
  }
}

export function encodeMultiSendTransactions(calls: InnerCall[]): Hex {
  if (calls.length === 0) {
    return '0x'
  }

  return concatHex(
    calls.map((call) =>
      concatHex([
        numberToHex(call.operation, { size: 1 }),
        pad(call.to, { size: 20 }),
        numberToHex(0, { size: 32 }),
        numberToHex(size(call.data), { size: 32 }),
        call.data,
      ]),
    ),
  )
}
