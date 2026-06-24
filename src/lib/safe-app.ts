'use client'

import SafeAppsSDK from '@safe-global/safe-apps-sdk'

import type { AtomicAccessManagerTx } from './proposal-builder'

export type SafeAppInfo = Awaited<ReturnType<SafeAppsSDK['safe']['getInfo']>>

export async function detectSafeApp(timeoutMs = 500): Promise<SafeAppInfo | null> {
  if (typeof window === 'undefined' || window.parent === window) {
    return null
  }

  const sdk = new SafeAppsSDK()

  try {
    return await Promise.race([
      sdk.safe.getInfo(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ])
  } catch {
    return null
  }
}

export async function submitSafeAppTransaction(transaction: AtomicAccessManagerTx) {
  const sdk = new SafeAppsSDK()
  return sdk.txs.send({
    txs: [
      {
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
      },
    ],
  })
}
