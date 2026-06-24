import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { getDeploymentForEnv } from '@/src/config/deployments'
import type { AtomicAccessManagerTx } from '@/src/lib/proposal-builder'
import { createShadowWalletClient, executeShadowPreflight } from '@/src/lib/shadow'
import { requireMarketAdminSession } from '@/src/lib/server/authz'

const shadowRequestSchema = z.object({
  transaction: z.object({
    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    value: z.literal('0'),
    data: z.string().regex(/^0x[a-fA-F0-9]*$/),
    functionName: z.literal('AccessManager.multicall'),
    innerCalls: z.array(
      z.object({
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        value: z.literal('0'),
        data: z.string().regex(/^0x[a-fA-F0-9]*$/),
        functionName: z.string(),
      }),
    ),
  }),
})

export async function POST(request: NextRequest) {
  const session = await requireMarketAdminSession(request)
  if (!session) {
    return NextResponse.json({ error: 'GitHub login required' }, { status: 401 })
  }

  const parsed = shadowRequestSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid shadow payload', issues: parsed.error.issues }, { status: 400 })
  }

  const shadow = getDeploymentForEnv('shadow')
  if (!shadow.shadowExecutor) {
    return NextResponse.json({ error: 'shadow executor is not configured' }, { status: 500 })
  }

  const result = await executeShadowPreflight({
    client: createShadowWalletClient(shadow.rpcUrl),
    executor: shadow.shadowExecutor,
    perpsAddress: shadow.addresses.perps,
    transaction: parsed.data.transaction as AtomicAccessManagerTx,
  })

  return NextResponse.json(result, { status: result.status === 'passed' ? 200 : 422 })
}
