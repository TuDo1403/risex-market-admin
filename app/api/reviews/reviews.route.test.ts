import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GET, POST } from './route'
import { GET as GET_ONE } from './[id]/route'
import { resetReviewStoreForTests } from '@/src/lib/server/review-store'

function request(url: string, init?: RequestInit) {
  return new NextRequest(new Request(url, init))
}

describe('review route handlers', () => {
  beforeEach(() => {
    process.env.MARKET_ADMIN_TEST_AUTH = '1'
    resetReviewStoreForTests()
  })

  afterEach(() => {
    delete process.env.MARKET_ADMIN_TEST_AUTH
    resetReviewStoreForTests()
  })

  it('rejects unauthenticated review creation', async () => {
    const response = await POST(
      request('http://localhost/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ env: 'shadow', draft: {}, generatedTx: {}, validation: {}, shadow: {} }),
      }),
    )

    expect(response.status).toBe(401)
  })

  it('creates, lists, and reads an authenticated review draft', async () => {
    const createResponse = await POST(
      request('http://localhost/api/reviews', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-github-login': 'tudo',
        },
        body: JSON.stringify({
          env: 'shadow',
          draft: { market: 'AERO/USD' },
          generatedTx: { safeTxGas: '0' },
          validation: { status: 'passed' },
          shadow: { status: 'passed' },
        }),
      }),
    )

    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()) as { id: string; shareId: string }
    expect(created.shareId).toMatch(/^rvw_/)

    const listResponse = await GET(
      request('http://localhost/api/reviews', {
        headers: {
          'x-test-github-login': 'tudo',
        },
      }),
    )
    const list = (await listResponse.json()) as { reviews: Array<{ id: string; shareId: string }> }
    expect(list.reviews).toEqual([expect.objectContaining({ id: created.id, shareId: created.shareId })])

    const readResponse = await GET_ONE(
      request(`http://localhost/api/reviews/${created.id}`, {
        headers: {
          'x-test-github-login': 'reviewer',
        },
      }),
      { params: Promise.resolve({ id: created.id }) },
    )
    const read = (await readResponse.json()) as { review: { draft: { market: string } } }
    expect(read.review.draft.market).toBe('AERO/USD')
  })
})
