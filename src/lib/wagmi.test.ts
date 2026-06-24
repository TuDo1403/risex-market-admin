import { describe, expect, it, vi } from 'vitest'

const wagmi = vi.hoisted(() => ({
  createConfig: vi.fn((config) => config),
  http: vi.fn((url: string) => ({ url })),
}))

const viem = vi.hoisted(() => ({
  defineChain: vi.fn((chain) => chain),
  getAddress: vi.fn((address: string) => address),
}))

vi.mock('wagmi', () => ({
  createConfig: wagmi.createConfig,
  http: wagmi.http,
}))

vi.mock('wagmi/connectors', () => ({
  injected: vi.fn(() => ({ id: 'injected' })),
}))

vi.mock('viem', () => viem)

describe('wagmi chain config', () => {
  it('registers RISE mainnet separately from testnet', async () => {
    const { riseMainnet, riseTestnet } = await import('./wagmi')
    const configInput = wagmi.createConfig.mock.calls[0][0]

    expect(riseTestnet.id).toBe(11155931)
    expect(riseMainnet.id).toBe(4153)
    expect(configInput.chains.map((chain: { id: number }) => chain.id)).toEqual([11155931, 4153])
    expect(configInput.transports[4153]).toEqual({ url: 'https://rpc.risechain.com' })
  })
})
