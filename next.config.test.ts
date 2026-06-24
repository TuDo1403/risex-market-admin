import { describe, expect, it } from 'vitest'

import nextConfig from './next.config'

describe('Next.js proxy config', () => {
  it('does not expose a shadow rpc proxy rewrite', async () => {
    const rewrites =
      typeof nextConfig.rewrites === 'function' ? await nextConfig.rewrites() : []

    expect(rewrites).toEqual([])
  })
})
