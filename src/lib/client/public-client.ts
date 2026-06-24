import { createPublicClient, defineChain, http, type PublicClient } from 'viem'

import { getDeploymentForEnv, type MarketAdminEnv } from '@/src/config/deployments'

// Browser-side viem client per environment. RISE RPC URLs are non-sensitive and live in
// the deployments config, so reads run directly from the client with no server route.
// `batch.multicall` enables the `client.multicall` used by the readers; `contracts.multicall3`
// tells viem which Multicall3 to route through.
export function getPublicClient(env: MarketAdminEnv): PublicClient {
  const d = getDeploymentForEnv(env)
  const chain = defineChain({
    id: d.chainId,
    name: `RISE ${env}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [d.rpcUrl] } },
    contracts: { multicall3: { address: d.multicall3Address } },
  })

  return createPublicClient({
    chain,
    transport: http(d.rpcUrl),
    batch: { multicall: true },
  })
}
