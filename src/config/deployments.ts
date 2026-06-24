import { getAddress, type Address } from 'viem'

export const ENVIRONMENTS = ['testnet', 'staging', 'mainnet', 'shadow'] as const

export type MarketAdminEnv = (typeof ENVIRONMENTS)[number]

export type DeploymentAddresses = {
  accessManager: Address
  ordersManager: Address
  perps: Address
  risexOracle: Address
  risexStork: Address
  usdc: Address
}

export type DeploymentEnvironment = {
  env: MarketAdminEnv
  chainId: number
  rpcUrl: string
  multicall3Address: Address
  addresses: DeploymentAddresses
  source: string
  shadowExecutor?: Address
}

type RuntimeEnv = NodeJS.ProcessEnv | Record<string, string | undefined>

const RISE_TESTNET_CHAIN_ID = 11155931
const MAINNET_RPC_URL = 'https://rpc.risechain.com'
const SHADOW_RPC_URL = 'http://shadow-rpc.riselabs.xyz'
export const TESTNET_RPC_URL = 'https://testnet.riselabs.xyz'
const SHADOW_EXECUTOR = getAddress('0x7CD9460423f9f1751B1F7F1581Aa74d7e4b0984D')
const TESTNET_USDC = getAddress('0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677')
const MAINNET_USDC = getAddress('0xe436820ba0C69702c1d3E601d421c0eF38262739')
const MULTICALL3_ADDRESS = getAddress('0xcA11bde05977b3631167028862bE2a173976CA11')

const mainnetAddresses: DeploymentAddresses = {
  accessManager: getAddress('0x1BEe39C01907E3018b7ec2021Cf73F70541b36cC'),
  ordersManager: getAddress('0xE03C1D5081eb2d0E6bFd62A949C5b12eFa44F2cD'),
  perps: getAddress('0x53f10fAcFC8965750494E6965F5d6dA39B41d852'),
  risexOracle: getAddress('0x8fC4D0Cf74cdF595254cB763d4C05D38Df0e9503'),
  risexStork: getAddress('0x76A559C716c5B93b9d743e08D9E9f23f96a4f975'),
  usdc: MAINNET_USDC,
}

const baseDeployments: Record<MarketAdminEnv, DeploymentEnvironment> = {
  testnet: {
    env: 'testnet',
    chainId: RISE_TESTNET_CHAIN_ID,
    rpcUrl: TESTNET_RPC_URL,
    multicall3Address: MULTICALL3_ADDRESS,
    source: 'risex-contracts/script/data/testnet/deployment.json',
    addresses: {
      accessManager: getAddress('0x1C9909EF68aC870ddb788dcE6955C4AC77A77a4C'),
      ordersManager: getAddress('0xa9f8Ec6C787208235aEC7C6AF50f1cFCe10319fB'),
      perps: getAddress('0x6B3cb699940a1A1814c71b8260a01eaC86f26572'),
      risexOracle: getAddress('0xb588f71d964a8cDBFA0B4c2A918ccb659a6EF2eA'),
      risexStork: getAddress('0xee01CF24AD96d4734fbBC3EDeF2139D4Fca74D47'),
      usdc: TESTNET_USDC,
    },
  },
  staging: {
    env: 'staging',
    chainId: RISE_TESTNET_CHAIN_ID,
    rpcUrl: TESTNET_RPC_URL,
    multicall3Address: MULTICALL3_ADDRESS,
    source: 'risex-contracts/script/data/staging/deployment.json',
    addresses: {
      accessManager: getAddress('0xa9a8717f9aaD949f21Fe27dC160629D43b04140D'),
      ordersManager: getAddress('0x8F9f27e63CDE48aa6845DBdd64B514430EF6D1Ca'),
      perps: getAddress('0x75A08e72805337aEbF0944D2caf152Fee7fA158A'),
      risexOracle: getAddress('0xb0A9a42E5cd3CA48C1f288CB0B427f41f3ab4885'),
      risexStork: getAddress('0xc5e5C5994183E82Fa379d18EeE73F3f998d2E633'),
      usdc: TESTNET_USDC,
    },
  },
  mainnet: {
    env: 'mainnet',
    chainId: RISE_TESTNET_CHAIN_ID,
    rpcUrl: MAINNET_RPC_URL,
    multicall3Address: MULTICALL3_ADDRESS,
    source: 'risex-contracts/script/data/mainnet/deployment.json',
    addresses: mainnetAddresses,
  },
  shadow: {
    env: 'shadow',
    chainId: RISE_TESTNET_CHAIN_ID,
    rpcUrl: SHADOW_RPC_URL,
    multicall3Address: MULTICALL3_ADDRESS,
    source: 'risex-contracts/script/data/mainnet/deployment.json',
    addresses: mainnetAddresses,
    shadowExecutor: SHADOW_EXECUTOR,
  },
}

export function isMarketAdminEnv(value: string): value is MarketAdminEnv {
  return ENVIRONMENTS.includes(value as MarketAdminEnv)
}

export function getDeploymentForEnv(env: MarketAdminEnv): DeploymentEnvironment {
  return baseDeployments[env]
}

export function getRuntimeEnvironment(
  env: MarketAdminEnv,
  runtimeEnv: RuntimeEnv = process.env,
): DeploymentEnvironment {
  const deployment = getDeploymentForEnv(env)

  if (env === 'mainnet') {
    return {
      ...deployment,
      rpcUrl: runtimeEnv.MAINNET_RPC_URL ?? MAINNET_RPC_URL,
    }
  }

  if (env === 'testnet' && runtimeEnv.TESTNET_RPC_URL) {
    return { ...deployment, rpcUrl: runtimeEnv.TESTNET_RPC_URL }
  }

  if (env === 'staging' && runtimeEnv.STAGING_RPC_URL) {
    return { ...deployment, rpcUrl: runtimeEnv.STAGING_RPC_URL }
  }

  if (env === 'shadow' && runtimeEnv.SHADOW_RPC_URL) {
    return { ...deployment, rpcUrl: runtimeEnv.SHADOW_RPC_URL }
  }

  return deployment
}
