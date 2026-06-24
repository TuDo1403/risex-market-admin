'use client'

import { createWalletClient, custom, getAddress, type Address, type Hex } from 'viem'

import type { AtomicAccessManagerTx } from './proposal-builder'

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
}

export type EoaWalletClient = {
  sendTransaction(args: { account: Address; to: Address; data: Hex; value: bigint }): Promise<Hex>
}

export async function connectInjectedWallet(provider: Eip1193Provider) {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
  const first = accounts[0]
  if (!first) {
    throw new Error('No wallet account returned')
  }

  return {
    account: getAddress(first),
    client: createWalletClient({
      transport: custom(provider),
    }),
  }
}

export async function sendWalletTransaction(
  walletClient: EoaWalletClient,
  account: Address,
  transaction: AtomicAccessManagerTx,
): Promise<Hex> {
  return walletClient.sendTransaction({
    account,
    to: transaction.to,
    data: transaction.data,
    value: BigInt(transaction.value),
  })
}
