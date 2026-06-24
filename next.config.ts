import { BROWSER_SHADOW_RPC_PATH } from './src/config/deployments'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/icons/safe-app.svg',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: BROWSER_SHADOW_RPC_PATH,
        destination: 'http://shadow-rpc.riselabs.xyz',
      },
    ]
  },
}

export default nextConfig
