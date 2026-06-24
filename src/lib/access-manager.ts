import type { Address, Hex, PublicClient } from 'viem'

import { accessManagerAbi } from './abis'
import type { InnerCall } from './proposal-builder'

type ReadContractClient = Pick<PublicClient, 'readContract'>

export type AccessCheckResult = {
  functionName: string
  target: Address
  selector: Hex
  allowed: boolean
}

export async function checkAccessForCalls(
  client: ReadContractClient,
  accessManager: Address,
  caller: Address,
  calls: InnerCall[],
): Promise<{ allowed: boolean; results: AccessCheckResult[] }> {
  const results: AccessCheckResult[] = []

  for (const call of calls) {
    const selector = call.data.slice(0, 10) as Hex
    const allowed = Boolean(
      await client.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: 'canCall',
        args: [caller, call.to, selector],
      }),
    )

    results.push({
      functionName: call.functionName,
      target: call.to,
      selector,
      allowed,
    })
  }

  return {
    allowed: results.every((result) => result.allowed),
    results,
  }
}
