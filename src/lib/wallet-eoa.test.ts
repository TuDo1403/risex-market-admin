import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { connectInjectedWallet, sendEoaTransactions } from './wallet-eoa'
import type { InnerCall } from './proposal-builder'

const account = '0x9953E4D18400Fc15125c27c3d0C83BE38D561d36' as Address
const target = '0x53f10fAcFC8965750494E6965F5d6dA39B41d852' as Address

describe('wallet EOA helpers', () => {
  it('requests an injected wallet account', async () => {
    const provider = {
      request: vi.fn().mockResolvedValue([account]),
    }

    const result = await connectInjectedWallet(provider)

    expect(result.account).toBe(account)
    expect(provider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' })
  })

  it('sends direct call transactions from the connected EOA', async () => {
    const calls: InnerCall[] = [
      { to: target, value: '0', data: '0x12345678', operation: 0, functionName: 'openMarket' },
    ]
    const walletClient = {
      sendTransaction: vi.fn().mockResolvedValue('0xhash'),
    }

    const hashes = await sendEoaTransactions(walletClient, account, calls)

    expect(hashes).toEqual(['0xhash'])
    expect(walletClient.sendTransaction).toHaveBeenCalledWith({
      account,
      to: target,
      data: '0x12345678',
      value: 0n,
    })
  })

  it('rejects delegatecall MultiSend transactions for EOA execution', async () => {
    const calls: InnerCall[] = [
      { to: target, value: '0', data: '0x12345678', operation: 1 as 0, functionName: 'multiSend' },
    ]
    const walletClient = {
      sendTransaction: vi.fn(),
    }

    await expect(sendEoaTransactions(walletClient, account, calls)).rejects.toThrow(/direct call/)
  })
})
