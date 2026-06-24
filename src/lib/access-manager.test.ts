import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { checkAccessForCalls } from './access-manager'
import type { InnerCall } from './proposal-builder'

const accessManager = '0x1BEe39C01907E3018b7ec2021Cf73F70541b36cC' as Address
const caller = '0x9953E4D18400Fc15125c27c3d0C83BE38D561d36' as Address
const perps = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address

describe('AccessManager selector checks', () => {
  it('checks every planned selector against the caller and target', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const calls: InnerCall[] = [
      { to: perps, value: '0', data: '0x264317e8' as const, functionName: 'openMarket' },
      { to: perps, value: '0', data: '0xd5a532d5' as const, functionName: 'setDeferredMode' },
    ]

    const result = await checkAccessForCalls({ readContract }, accessManager, caller, calls)

    expect(result.allowed).toBe(false)
    expect(result.results).toEqual([
      expect.objectContaining({ functionName: 'openMarket', selector: '0x264317e8', allowed: true }),
      expect.objectContaining({ functionName: 'setDeferredMode', selector: '0xd5a532d5', allowed: false }),
    ])
    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ args: [caller, perps, '0x264317e8'] }),
    )
  })
})
