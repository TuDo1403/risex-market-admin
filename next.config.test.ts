import { describe, expect, it } from 'vitest'

import nextConfig from './next.config'

describe('Next.js proxy config', () => {
  it('proxies browser shadow rpc through a same-origin path', async () => {
    const rewrites =
      typeof nextConfig.rewrites === 'function' ? await nextConfig.rewrites() : []

    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: '/rpc/shadow',
          destination: 'http://shadow-rpc.riselabs.xyz',
        },
      ]),
    )
  })
})
