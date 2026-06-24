'use client'

import SafeAppsSDK from '@safe-global/safe-apps-sdk'

import type { SafeTxJson } from './proposal-builder'

export async function submitSafeProposal(safeTx: SafeTxJson) {
  const sdk = new SafeAppsSDK()
  return sdk.txs.send({
    txs: [
      {
        to: safeTx.to,
        value: safeTx.value,
        data: safeTx.data,
      },
    ],
  })
}
