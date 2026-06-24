import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  publicActions,
  toHex,
  type Address,
  type Hex,
} from 'viem'

import { perpsMarketConfigAbi } from './abis'
import type { AtomicAccessManagerTx } from './proposal-builder'

export const SHADOW_FALLBACK_GAS_LIMIT = 8_000_000n

type ShadowClient = {
  sendTransaction(args: { account: Address; to: Address; data: Hex; value: bigint }): Promise<Hex>
  waitForTransactionReceipt(args: { hash: Hex }): Promise<{ status: 'success' | 'reverted' }>
  readContract(args: {
    address: Address
    abi: typeof perpsMarketConfigAbi
    functionName: 'getTotalMarkets'
  }): Promise<bigint | number>
}

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

export type ShadowTransactionSigner = {
  signTransaction(args: {
    from: Address
    to: Address
    data: Hex
    value: bigint
    chainId: number
    gas: bigint
    gasPrice: bigint
    nonce: number
  }): Promise<Hex>
}

export type ShadowPreflightInput = {
  client: ShadowClient
  executor: Address
  perpsAddress: Address
  transaction: AtomicAccessManagerTx
}

export type ShadowPreflightResult =
  | {
      status: 'passed'
      txHashes: Hex[]
      preTotalMarkets: number
      postTotalMarkets: number
    }
  | {
      status: 'failed'
      txHashes: Hex[]
      preTotalMarkets?: number
      postTotalMarkets?: number
      error: string
    }

export function createEip1193TransactionSigner(provider: Eip1193Provider): ShadowTransactionSigner {
  return {
    async signTransaction(args) {
      const signed = await provider.request({
        method: 'eth_signTransaction',
        params: [
          {
            from: args.from,
            to: args.to,
            data: args.data,
            value: toHex(args.value),
            chainId: toHex(args.chainId),
            gas: toHex(args.gas),
            gasPrice: toHex(args.gasPrice),
            nonce: toHex(args.nonce),
          },
        ],
      })

      if (typeof signed !== 'string' || !signed.startsWith('0x')) {
        throw new Error('wallet did not return a signed transaction')
      }

      return signed as Hex
    },
  }
}

export async function createShadowWalletClient(rpcUrl: string, signer?: ShadowTransactionSigner) {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  })
  const chainId = await publicClient.getChainId()
  const chain = defineChain({
    id: chainId,
    name: 'RISE Mainnet Shadow',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  const shadowClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  }).extend(publicActions)

  if (signer) {
    return {
      async sendTransaction(args: { account: Address; to: Address; data: Hex; value: bigint }) {
        const [nonce, gasPrice] = await Promise.all([
          shadowClient.getTransactionCount({ address: args.account }),
          shadowClient.getGasPrice(),
        ])
        let gas = SHADOW_FALLBACK_GAS_LIMIT
        try {
          gas = await shadowClient.estimateGas({
            account: args.account,
            to: args.to,
            data: args.data,
            value: args.value,
          })
        } catch {
          // Shadow preflight should broadcast and let the receipt/post-state report
          // the real result; estimateGas commonly reverts for transactions we still
          // want to test on the fork.
        }
        const serializedTransaction = await signer.signTransaction({
          from: args.account,
          to: args.to,
          data: args.data,
          value: args.value,
          chainId,
          gas,
          gasPrice,
          nonce,
        })

        return shadowClient.sendRawTransaction({ serializedTransaction })
      },
      waitForTransactionReceipt: (args: { hash: Hex }) => shadowClient.waitForTransactionReceipt(args),
      readContract: (args: {
        address: Address
        abi: typeof perpsMarketConfigAbi
        functionName: 'getTotalMarkets'
      }) => shadowClient.readContract(args),
    }
  }

  return createWalletClient({
    chain,
    transport: http(rpcUrl),
  }).extend(publicActions)
}

export async function executeShadowPreflight(
  input: ShadowPreflightInput,
): Promise<ShadowPreflightResult> {
  const txHashes: Hex[] = []
  let preTotalMarkets: number | undefined

  try {
    preTotalMarkets = await readTotalMarkets(input.client, input.perpsAddress)

    const hash = await input.client.sendTransaction({
      account: input.executor,
      to: input.transaction.to,
      data: input.transaction.data,
      value: BigInt(input.transaction.value),
    })
    txHashes.push(hash)

    const receipt = await input.client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`shadow transaction ${hash} reverted`)
    }

    const postTotalMarkets = await readTotalMarkets(input.client, input.perpsAddress)

    return {
      status: 'passed',
      txHashes,
      preTotalMarkets,
      postTotalMarkets,
    }
  } catch (error) {
    return {
      status: 'failed',
      txHashes,
      preTotalMarkets,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function readTotalMarkets(client: ShadowClient, perpsAddress: Address): Promise<number> {
  return Number(
    await client.readContract({
      address: perpsAddress,
      abi: perpsMarketConfigAbi,
      functionName: 'getTotalMarkets',
    }),
  )
}
