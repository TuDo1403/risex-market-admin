import type { MarketAdminEnv } from '@/src/config/deployments'

// Stateless shareable review links: the proposal/draft payload is encoded into the URL
// itself (no database). The token is base64url of the JSON payload, so it is URL-safe and
// decodes in the browser and on the server (the review page) without any backend lookup.
export type ReviewPayload = {
  env: MarketAdminEnv
  draft: unknown
  proposal: unknown
  validation?: unknown
  createdAt: string
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): Uint8Array {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function encodeReview(payload: ReviewPayload): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

export function decodeReview(token: string): ReviewPayload {
  const json = new TextDecoder().decode(fromBase64Url(token))
  return JSON.parse(json) as ReviewPayload
}
