import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { isMarketAdminEnv } from '@/src/config/deployments'
import { requireMarketAdminSession } from '@/src/lib/server/authz'
import { getReviewStore } from '@/src/lib/server/review-store'

const reviewBodySchema = z.object({
  env: z.string().refine(isMarketAdminEnv),
  draft: z.record(z.unknown()),
  generatedTx: z.record(z.unknown()),
  validation: z.record(z.unknown()),
  shadow: z.record(z.unknown()),
})

export async function GET(request: NextRequest) {
  const session = await requireMarketAdminSession(request)
  if (!session) {
    return NextResponse.json({ error: 'GitHub login required' }, { status: 401 })
  }

  const reviews = await getReviewStore().listForOwner(session.githubId)
  return NextResponse.json({ reviews })
}

export async function POST(request: NextRequest) {
  const session = await requireMarketAdminSession(request)
  if (!session) {
    return NextResponse.json({ error: 'GitHub login required' }, { status: 401 })
  }

  const parsed = reviewBodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid review payload', issues: parsed.error.issues }, { status: 400 })
  }

  const review = await getReviewStore().create({
    owner: session,
    ...parsed.data,
  })

  return NextResponse.json(review, { status: 201 })
}
