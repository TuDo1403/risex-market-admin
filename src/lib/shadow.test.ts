import type { Address } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AtomicAccessManagerTx } from './proposal-builder'
import { createEip1193TransactionSigner, executeShadowPreflight } from './shadow'

const executor = '0x7CD9460423f9f1751B1F7F1581Aa74d7e4b0984D' as Address
const perps = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address
const accessManager = '0x1BEe39C01907E3018b7ec2021Cf73F70541b36cC' as Address

const transaction: AtomicAccessManagerTx = {
  to: accessManager,
  value: '0',
  data: '0x12345678',
  functionName: 'AccessManager.multicall',
  innerCalls: [{ to: perps, value: '0', data: '0xabcdef01', functionName: 'openMarket' }],
}

describe('shadow preflight executor', () => {
  afterEach(() => {
    vi.doUnmock('viem')
    vi.resetModules()
  })

  it('defines the shadow wallet chain from the RPC-reported chain id', async () => {
    vi.resetModules()
    const wallet = { extend: vi.fn((actions) => ({ actions, wallet: true })) }
    const viemMocks = {
      createPublicClient: vi.fn(() => ({
        getChainId: vi.fn().mockResolvedValue(4153),
        extend: vi.fn(() => ({ public: true })),
      })),
      createWalletClient: vi.fn(() => wallet),
      defineChain: vi.fn((chain) => chain),
      http: vi.fn((url: string) => ({ url })),
      publicActions: { public: true },
    }
    vi.doMock('viem', () => viemMocks)
    const { createShadowWalletClient } = await import('./shadow')

    await createShadowWalletClient('http://shadow-rpc.riselabs.xyz')

    expect(viemMocks.createPublicClient).toHaveBeenCalledWith({
      transport: { url: 'http://shadow-rpc.riselabs.xyz' },
    })
    expect(viemMocks.defineChain).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 4153,
        name: 'RISE Mainnet Shadow',
        rpcUrls: { default: { http: ['http://shadow-rpc.riselabs.xyz'] } },
      }),
    )
    expect(viemMocks.createWalletClient).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: expect.objectContaining({ id: 4153 }),
        transport: { url: 'http://shadow-rpc.riselabs.xyz' },
      }),
    )
  })

  it('signs transactions with an injected wallet and broadcasts the raw tx to shadow rpc', async () => {
    vi.resetModules()
    const provider = { request: vi.fn().mockResolvedValue('0xsigned') }
    const publicClient = {
      getChainId: vi.fn().mockResolvedValue(4153),
      getTransactionCount: vi.fn().mockResolvedValue(7),
      getGasPrice: vi.fn().mockResolvedValue(1_000_000n),
      estimateGas: vi.fn().mockResolvedValue(250_000n),
      sendRawTransaction: vi.fn().mockResolvedValue('0xhash'),
      waitForTransactionReceipt: vi.fn(),
      readContract: vi.fn(),
      extend: vi.fn(() => publicClient),
    }
    const viemMocks = {
      createPublicClient: vi.fn(() => publicClient),
      createWalletClient: vi.fn(),
      defineChain: vi.fn((chain) => chain),
      http: vi.fn((url: string) => ({ url })),
      publicActions: { public: true },
      toHex: vi.fn((value: bigint | number) => `0x${value.toString(16)}`),
    }
    vi.doMock('viem', () => viemMocks)
    const { createEip1193TransactionSigner: createSigner, createShadowWalletClient } = await import('./shadow')

    const client = await createShadowWalletClient(
      'http://shadow-rpc.riselabs.xyz',
      createSigner(provider),
    )
    const hash = await client.sendTransaction({
      account: executor,
      to: accessManager,
      data: '0x12345678',
      value: 0n,
    })

    expect(hash).toBe('0xhash')
    expect(publicClient.getTransactionCount).toHaveBeenCalledWith({ address: executor })
    expect(publicClient.estimateGas).toHaveBeenCalledWith({
      account: executor,
      to: accessManager,
      data: '0x12345678',
      value: 0n,
    })
    expect(provider.request).toHaveBeenCalledWith({
      method: 'eth_signTransaction',
      params: [
        {
          from: executor,
          to: accessManager,
          data: '0x12345678',
          value: '0x0',
          chainId: '0x1039',
          gas: '0x3d090',
          gasPrice: '0xf4240',
          nonce: '0x7',
        },
      ],
    })
    expect(publicClient.sendRawTransaction).toHaveBeenCalledWith({
      serializedTransaction: '0xsigned',
    })
  })

  it('falls back to a fixed gas limit when shadow gas estimation reverts', async () => {
    vi.resetModules()
    const provider = { request: vi.fn().mockResolvedValue('0xsigned') }
    const publicClient = {
      getChainId: vi.fn().mockResolvedValue(4153),
      getTransactionCount: vi.fn().mockResolvedValue(7),
      getGasPrice: vi.fn().mockResolvedValue(1_000_000n),
      estimateGas: vi.fn().mockRejectedValue(new Error('execution reverted')),
      sendRawTransaction: vi.fn().mockResolvedValue('0xhash'),
      waitForTransactionReceipt: vi.fn(),
      readContract: vi.fn(),
      extend: vi.fn(() => publicClient),
    }
    const viemMocks = {
      createPublicClient: vi.fn(() => publicClient),
      createWalletClient: vi.fn(),
      defineChain: vi.fn((chain) => chain),
      http: vi.fn((url: string) => ({ url })),
      publicActions: { public: true },
      toHex: vi.fn((value: bigint | number) => `0x${value.toString(16)}`),
    }
    vi.doMock('viem', () => viemMocks)
    const { createEip1193TransactionSigner: createSigner, createShadowWalletClient } = await import('./shadow')

    const client = await createShadowWalletClient(
      'http://shadow-rpc.riselabs.xyz',
      createSigner(provider),
    )
    await client.sendTransaction({
      account: executor,
      to: accessManager,
      data: '0x12345678',
      value: 0n,
    })

    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_signTransaction',
        params: [
          expect.objectContaining({
            gas: '0x7a1200',
          }),
        ],
      }),
    )
    expect(publicClient.sendRawTransaction).toHaveBeenCalledWith({
      serializedTransaction: '0xsigned',
    })
  })

  it('rejects wallet signing responses that are not raw transactions', async () => {
    const signer = createEip1193TransactionSigner({ request: vi.fn().mockResolvedValue(null) })

    await expect(
      signer.signTransaction({
        from: executor,
        to: accessManager,
        data: '0x12345678',
        value: 0n,
        chainId: 4153,
        gas: 21_000n,
        gasPrice: 1n,
        nonce: 0,
      }),
    ).rejects.toThrow(/signed transaction/)
  })

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
      transaction,
    })

    expect(result.status).toBe('passed')
    expect(result.preTotalMarkets).toBe(15)
    expect(result.postTotalMarkets).toBe(16)
    expect(result.txHashes).toEqual(['0xhash'])
    expect(client.sendTransaction).toHaveBeenCalledWith({
      account: executor,
      to: accessManager,
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
      transaction,
    })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') {
      throw new Error('expected failed result')
    }
    expect(result.error).toMatch(/reverted/)
    expect(result.txHashes).toEqual(['0xhash'])
  })
})
