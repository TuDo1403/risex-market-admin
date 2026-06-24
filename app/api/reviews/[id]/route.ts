import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireMarketAdminSession } from '@/src/lib/server/authz'
import { getReviewStore } from '@/src/lib/server/review-store'

const patchSchema = z.object({
  draft: z.record(z.unknown()).optional(),
  generatedTx: z.record(z.unknown()).optional(),
  validation: z.record(z.unknown()).optional(),
  shadow: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'ready', 'revoked']).optional(),
})

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireMarketAdminSession(request)
  if (!session) {
    return NextResponse.json({ error: 'GitHub login required' }, { status: 401 })
  }

  const { id } = await params
  const review = await getReviewStore().getById(id)
  if (!review || review.status === 'revoked') {
    return NextResponse.json({ error: 'review not found' }, { status: 404 })
  }

  return NextResponse.json({ review })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireMarketAdminSession(request)
  if (!session) {
    return NextResponse.json({ error: 'GitHub login required' }, { status: 401 })
  }

  const { id } = await params
  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid review payload', issues: parsed.error.issues }, { status: 400 })
  }

  const review = await getReviewStore().getById(id)
  if (!review) {
    return NextResponse.json({ error: 'review not found' }, { status: 404 })
  }
  if (review.ownerGithubId !== session.githubId) {
    return NextResponse.json({ error: 'owner required' }, { status: 403 })
  }

  const updated = await getReviewStore().update(id, parsed.data)
  return NextResponse.json({ review: updated })
}
