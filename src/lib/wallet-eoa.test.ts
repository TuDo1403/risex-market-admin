import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { connectInjectedWallet, sendWalletTransaction } from './wallet-eoa'
import type { AtomicAccessManagerTx } from './proposal-builder'

const account = '0x9953E4D18400Fc15125c27c3d0C83BE38D561d36' as Address
const target = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address
const accessManager = '0x1BEe39C01907E3018b7ec2021Cf73F70541b36cC' as Address

describe('wallet transaction helpers', () => {
  it('requests an injected wallet account', async () => {
    const provider = {
      request: vi.fn().mockResolvedValue([account]),
    }

    const result = await connectInjectedWallet(provider)

    expect(result.account).toBe(account)
    expect(provider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' })
  })

  it('sends one atomic AccessManager transaction from the connected wallet', async () => {
    const transaction: AtomicAccessManagerTx = {
      to: accessManager,
      value: '0',
      data: '0x12345678',
      functionName: 'AccessManager.multicall',
      innerCalls: [{ to: target, value: '0', data: '0xabcdef01', functionName: 'openMarket' }],
    }
    const walletClient = {
      sendTransaction: vi.fn().mockResolvedValue('0xhash'),
    }

    const hash = await sendWalletTransaction(walletClient, account, transaction)

    expect(hash).toBe('0xhash')
    expect(walletClient.sendTransaction).toHaveBeenCalledWith({
      account,
      to: accessManager,
      data: '0x12345678',
      value: 0n,
    })
  })
})
