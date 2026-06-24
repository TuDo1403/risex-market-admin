import { decodeFunctionData, type Address, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import { accessManagerAbi, perpsMarketConfigAbi } from './abis'
import { buildOpenMarketProposal, buildUpdateMarketProposal } from './proposal-builder'

const accessManager = '0x1BEe39C01907E3018b7ec2021Cf73F70541b36cC' as Address
const perps = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address
const quote = '0x0000000000000000000000000000000000000002' as Address

const baseConfig = {
  name: 'AERO/USDC',
  quote,
  unlocked: true,
  maxLeverage: 3n,
  maintenanceMarginFactor: 4_500_000_000_000_000_000n,
  minOrderStep: 20n,
  maxOrderStep: 200_000n,
  oiLimitSteps: 2_000_000n,
  stepSize: 1n,
  stepPrice: 1_000n,
  matchPriceBandBps: 0n,
}

function decodeOuterExecuteCalls(data: Hex) {
  const decoded = decodeFunctionData({
    abi: accessManagerAbi,
    data,
  })

  expect(decoded.functionName).toBe('multicall')
  return decoded.args[0]
}

describe('market proposal builder', () => {
  it('wraps open market calls in one AccessManager multicall transaction', () => {
    const proposal = buildOpenMarketProposal({
      accessManagerAddress: accessManager,
      perpsAddress: perps,
      nextMarketId: 15,
      perpsConfig: baseConfig,
      bookConfig: {
        stepSize: 1n,
        stepPrice: 1_000n,
      },
      markPriceId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      indexPriceId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      deferredMode: true,
      impactNotionalBaseUsdc: 50n,
    })

    expect(proposal.innerCalls.map((call) => call.functionName)).toEqual([
      'openMarket',
      'setDeferredMode',
      'setImpactNotionalBaseUsdc',
    ])
    expect(proposal.transaction).toMatchObject({
      to: accessManager,
      value: '0',
      functionName: 'AccessManager.multicall',
    })

    const executeCalls = decodeOuterExecuteCalls(proposal.transaction.data)
    expect(executeCalls).toHaveLength(3)

    const firstExecute = decodeFunctionData({
      abi: accessManagerAbi,
      data: executeCalls[0]! as Hex,
    })
    expect(firstExecute.functionName).toBe('execute')
    expect(firstExecute.args[0]).toBe(perps)

    const deferred = decodeFunctionData({
      abi: perpsMarketConfigAbi,
      data: proposal.innerCalls[1]!.data,
    })
    expect(deferred.functionName).toBe('setDeferredMode')
    expect(deferred.args).toEqual([15, true])

    const impact = decodeFunctionData({
      abi: perpsMarketConfigAbi,
      data: proposal.innerCalls[2]!.data,
    })
    expect(impact.functionName).toBe('setImpactNotionalBaseUsdc')
    expect(impact.args).toEqual([15, 50n])
  })

  it('wraps update, lock, deferred mode, and impact changes in one AccessManager multicall transaction', () => {
    const proposal = buildUpdateMarketProposal({
      accessManagerAddress: accessManager,
      perpsAddress: perps,
      marketId: 2,
      perpsConfig: baseConfig,
      lock: true,
      deferredMode: true,
      impactNotionalBaseUsdc: 100n,
    })

    expect(proposal.innerCalls.map((call) => call.functionName)).toEqual([
      'updateMarketConfig',
      'setMarketLock',
      'setDeferredMode',
      'setImpactNotionalBaseUsdc',
    ])
    expect(decodeOuterExecuteCalls(proposal.transaction.data)).toHaveLength(4)

    const lock = decodeFunctionData({
      abi: perpsMarketConfigAbi,
      data: proposal.innerCalls[1]!.data,
    })
    expect(lock.functionName).toBe('setMarketLock')
    expect(lock.args).toEqual([2, false])
  })
})
