// src/lib/abis.test.ts
import { describe, expect, it } from 'vitest'
import { getAbiItem } from 'viem'
import { perpsMarketConfigAbi } from './abis'

describe('contract abis', () => {
  it('getTotalMarkets returns uint256', () => {
    const item = getAbiItem({ abi: perpsMarketConfigAbi, name: 'getTotalMarkets' })
    expect(item?.outputs[0].type).toBe('uint256')
  })

  it('openMarket bookConfig is exactly {stepSize,stepPrice} uint64', () => {
    const item = getAbiItem({ abi: perpsMarketConfigAbi, name: 'openMarket' })
    const params = item!.inputs[0] as unknown as { components: { name: string; type: string; components?: unknown[] }[] }
    const book = params.components.find((c) => c.name === 'bookConfig') as { components: { name: string; type: string }[] }
    expect(book.components.map((c) => `${c.name}:${c.type}`)).toEqual(['stepSize:uint64', 'stepPrice:uint64'])
  })

  it('setMarketLock second arg is the unlocked flag', () => {
    const item = getAbiItem({ abi: perpsMarketConfigAbi, name: 'setMarketLock' })
    expect(item!.inputs[1].name).toBe('unlocked')
  })
})
