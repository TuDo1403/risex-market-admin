import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

import {
  getDeploymentForEnv,
  SHADOW_CHAIN_ID,
  SHADOW_RPC_URL,
  TESTNET_RPC_URL,
} from '@/src/config/deployments'

// RISE testnet/staging/mainnet use chainId 11155931 in current deployments. The
// shadow fork exposes its own RPC chain id and is registered separately for wallet
// signing against the fork.
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

export const riseShadow = defineChain({
  id: SHADOW_CHAIN_ID,
  name: 'RISE Mainnet Shadow',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [SHADOW_RPC_URL] } },
  contracts: {
    multicall3: {
      address: getDeploymentForEnv('shadow').multicall3Address,
    },
  },
})

export const wagmiConfig = createConfig({
  chains: [riseTestnet, riseShadow],
  connectors: [injected()],
  transports: {
    [riseTestnet.id]: http(TESTNET_RPC_URL),
    [riseShadow.id]: http(SHADOW_RPC_URL),
  },
  ssr: true,
})
