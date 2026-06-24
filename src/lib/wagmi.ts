import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

import { getDeploymentForEnv, TESTNET_RPC_URL } from '@/src/config/deployments'

// RISE testnet/staging/shadow all run chainId 11155931; mainnet is a placeholder on the
// same id until a real chain/RPC is provisioned. A single registered chain is enough for
// wallet signing — market reads run client-side via getPublicClient against RISE RPC.
export const riseTestnet = defineChain({
  id: 11155931,
  name: 'RISE Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [TESTNET_RPC_URL] } },
  contracts: {
    multicall3: {
      address: getDeploymentForEnv('testnet').multicall3Address,
    },
  },
})

export const wagmiConfig = createConfig({
  chains: [riseTestnet],
  connectors: [injected()],
  transports: { [riseTestnet.id]: http(TESTNET_RPC_URL) },
  ssr: true,
})
