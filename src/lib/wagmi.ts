import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected, safe } from 'wagmi/connectors'

import {
  getDeploymentForEnv,
  MAINNET_RPC_URL,
  RISE_MAINNET_CHAIN_ID,
  TESTNET_RPC_URL,
} from '@/src/config/deployments'

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

export const riseMainnet = defineChain({
  id: RISE_MAINNET_CHAIN_ID,
  name: 'RISE Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [MAINNET_RPC_URL] } },
  contracts: {
    multicall3: {
      address: getDeploymentForEnv('mainnet').multicall3Address,
    },
  },
})

export const wagmiConfig = createConfig({
  chains: [riseTestnet, riseMainnet],
  // injected stays first so a plain browser keeps its existing behaviour; the Safe
  // connector only yields a provider inside a Safe App iframe. Its getInfo timeout
  // defaults to 10ms, which is tight for a real Safe — matched to detectSafeApp.
  connectors: [injected(), safe({ unstable_getInfoTimeout: 500 })],
  transports: {
    [riseTestnet.id]: http(TESTNET_RPC_URL),
    [riseMainnet.id]: http(MAINNET_RPC_URL),
  },
  ssr: true,
})
