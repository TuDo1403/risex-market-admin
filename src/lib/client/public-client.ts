import { createPublicClient, defineChain, http, type PublicClient } from 'viem'

import { getBrowserRpcUrl, getDeploymentForEnv, type MarketAdminEnv } from '@/src/config/deployments'

// Browser-side viem client per environment. Most reads go directly to public RPC URLs;
// shadow reads use the same-origin /rpc/shadow rewrite to avoid browser CORS/mixed content.
// `batch.multicall` enables the `client.multicall` used by the readers; `contracts.multicall3`
// tells viem which Multicall3 to route through.
export function getPublicClient(env: MarketAdminEnv): PublicClient {
  const d = getDeploymentForEnv(env)
  const rpcUrl = getBrowserRpcUrl(env)
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
