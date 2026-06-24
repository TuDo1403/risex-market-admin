import { decodeFunctionData, type Address } from 'viem'
import { describe, expect, it } from 'vitest'

import { perpsMarketConfigAbi } from './abis'
import { buildOpenMarketProposal, MULTISEND_CALL_ONLY } from './proposal-builder'

const perps = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address
const quote = '0x0000000000000000000000000000000000000002' as Address

describe('open market proposal builder', () => {
  it('builds ordered inner calls and a Safe MultiSend transaction', () => {
    const proposal = buildOpenMarketProposal({
      perpsAddress: perps,
      nextMarketId: 15,
      perpsConfig: {
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
      },
      bookConfig: {
        base: '0x0000000000000000000000000000000000000001',
        quote: '0x0000000000000000000000000000000000000002',
        pricePrecision: 8,
        sizePrecision: 0,
        tickSize: 1_000n,
        minSize: 20n,
        maxSize: 200_000n,
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
    expect(proposal.safeTx).toMatchObject({
      to: MULTISEND_CALL_ONLY,
      value: '0',
      operation: 1,
    })
    expect(proposal.safeTx.data).toMatch(/^0x8d80ff0a/)

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
})
