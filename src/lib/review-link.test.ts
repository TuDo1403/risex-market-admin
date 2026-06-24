import { describe, expect, it } from 'vitest'

import { decodeReview, encodeReview, type ReviewPayload } from './review-link'

const payload: ReviewPayload = {
  env: 'testnet',
  draft: { symbol: 'AERO', maxLeverage: 10 },
  proposal: {
    innerCalls: [{ to: '0x0000000000000000000000000000000000000001', value: '0', data: '0xabcdef', operation: 0, functionName: 'openMarket' }],
    safeTx: { to: '0x0000000000000000000000000000000000000002', value: '0', data: '0x8d80ff0a', operation: 1 },
  },
  validation: { numeric: true },
  createdAt: '2026-06-24T00:00:00.000Z',
}

describe('stateless review links', () => {
  it('round-trips a payload through encode/decode', () => {
    expect(decodeReview(encodeReview(payload))).toEqual(payload)
  })

  it('produces a URL-safe token (no +, /, or = padding)', () => {
    const token = encodeReview(payload)
    expect(token).not.toMatch(/[+/=]/)
  })

  it('preserves nested hex strings exactly', () => {
    const decoded = decodeReview(encodeReview(payload))
    const proposal = decoded.proposal as { innerCalls: { data: string }[] }
    expect(proposal.innerCalls[0].data).toBe('0xabcdef')
  })
})
