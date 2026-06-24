import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

import {
  getDeploymentForEnv,
  TESTNET_RPC_URL,
} from '@/src/config/deployments'

// RISE testnet/staging/mainnet use chainId 11155931 in current deployments.
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
  transports: {
    [riseTestnet.id]: http(TESTNET_RPC_URL),
  },
  ssr: true,
})
