import { createPublicClient, defineChain, http, type PublicClient } from 'viem'

import { getDeploymentForEnv, type MarketAdminEnv } from '@/src/config/deployments'

// Browser-side viem client per environment.
// `batch.multicall` enables the `client.multicall` used by the readers; `contracts.multicall3`
// tells viem which Multicall3 to route through.
export function getPublicClient(env: MarketAdminEnv): PublicClient {
  const d = getDeploymentForEnv(env)
  const rpcUrl = d.rpcUrl
  const chain = defineChain({
    id: d.chainId,
    name: `RISE ${env}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    contracts: { multicall3: { address: d.multicall3Address } },
  })

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
    batch: { multicall: true },
  })
}
