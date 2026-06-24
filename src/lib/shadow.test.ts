import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import type { InnerCall } from './proposal-builder'
import { executeShadowPreflight } from './shadow'

const executor = '0x7CD9460423f9f1751B1F7F1581Aa74d7e4b0984D' as Address
const perps = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address

const innerCalls: InnerCall[] = [
  {
    to: perps,
    value: '0',
    data: '0x12345678',
    operation: 0,
    functionName: 'openMarket',
  },
]

describe('shadow preflight executor', () => {
  it('sends planned calls from the shadow executor and returns post-state', async () => {
    const client = {
      sendTransaction: vi.fn().mockResolvedValue('0xhash'),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
      readContract: vi.fn().mockResolvedValueOnce(15n).mockResolvedValueOnce(16n),
    }

    const result = await executeShadowPreflight({
      client,
      executor,
      perpsAddress: perps,
      calls: innerCalls,
    })

    expect(result.status).toBe('passed')
    expect(result.preTotalMarkets).toBe(15)
    expect(result.postTotalMarkets).toBe(16)
    expect(result.txHashes).toEqual(['0xhash'])
    expect(client.sendTransaction).toHaveBeenCalledWith({
      account: executor,
      to: perps,
      data: '0x12345678',
      value: 0n,
    })
  })

  it('returns a failed result when any shadow transaction reverts', async () => {
    const client = {
      sendTransaction: vi.fn().mockResolvedValue('0xhash'),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'reverted' }),
      readContract: vi.fn().mockResolvedValueOnce(15n),
    }

    const result = await executeShadowPreflight({
      client,
      executor,
      perpsAddress: perps,
      calls: innerCalls,
    })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') {
      throw new Error('expected failed result')
    }
    expect(result.error).toMatch(/reverted/)
    expect(result.txHashes).toEqual(['0xhash'])
  })
})
