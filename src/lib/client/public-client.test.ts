import { describe, expect, it, vi } from 'vitest'

const viem = vi.hoisted(() => ({
  createPublicClient: vi.fn((config) => config),
  defineChain: vi.fn((chain) => chain),
  getAddress: vi.fn((address: string) => address),
  http: vi.fn((url: string) => ({ url })),
}))

vi.mock('viem', () => viem)

describe('public client rpc selection', () => {
  it('uses the selected deployment rpc and multicall address', async () => {
    const { getPublicClient } = await import('./public-client')

    getPublicClient('mainnet')

    expect(viem.http).toHaveBeenCalledWith('https://rpc.risechain.com')
    expect(viem.defineChain).toHaveBeenCalledWith(
      expect.objectContaining({
        rpcUrls: { default: { http: ['https://rpc.risechain.com'] } },
        contracts: {
          multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
          },
        },
      }),
    )
  })
})
