import { createWalletClient, http, publicActions, type Address, type Hex } from 'viem'

import { perpsMarketConfigAbi } from './abis'
import type { AtomicAccessManagerTx } from './proposal-builder'

type ShadowClient = {
  sendTransaction(args: { account: Address; to: Address; data: Hex; value: bigint }): Promise<Hex>
  waitForTransactionReceipt(args: { hash: Hex }): Promise<{ status: 'success' | 'reverted' }>
  readContract(args: {
    address: Address
    abi: typeof perpsMarketConfigAbi
    functionName: 'getTotalMarkets'
  }): Promise<bigint | number>
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

export function createShadowWalletClient(rpcUrl: string) {
  return createWalletClient({
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
