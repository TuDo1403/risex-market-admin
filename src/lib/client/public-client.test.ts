import { describe, expect, it, vi } from 'vitest'

const viem = vi.hoisted(() => ({
  createPublicClient: vi.fn((config) => config),
  defineChain: vi.fn((chain) => chain),
  getAddress: vi.fn((address: string) => address),
  http: vi.fn((url: string) => ({ url })),
}))

vi.mock('viem', () => viem)

describe('public client rpc selection', () => {
  it('uses same-origin proxy path for shadow browser reads', async () => {
    const { getPublicClient } = await import('./public-client')

    getPublicClient('shadow')

    expect(viem.http).toHaveBeenCalledWith('/rpc/shadow')
    expect(viem.defineChain).toHaveBeenCalledWith(
      expect.objectContaining({
        rpcUrls: { default: { http: ['/rpc/shadow'] } },
      }),
    )
  })
})
