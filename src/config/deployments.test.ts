import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'

import {
  ENVIRONMENTS,
  getDeploymentForEnv,
  getRuntimeEnvironment,
  isMarketAdminEnv,
} from './deployments'

describe('deployment environment config', () => {
  it('lists only the supported market-admin environments', () => {
    expect(ENVIRONMENTS).toEqual(['testnet', 'staging', 'mainnet'])
    expect(isMarketAdminEnv('testnet')).toBe(true)
    expect(isMarketAdminEnv('shadow')).toBe(false)
    expect(isMarketAdminEnv('devnet')).toBe(false)
  })

  it('loads testnet addresses from risex-contracts deployment JSON', () => {
    expect(getDeploymentForEnv('testnet')).toMatchObject({
      env: 'testnet',
      chainId: 11155931,
      rpcUrl: 'https://testnet.riselabs.xyz',
      multicall3Address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      addresses: {
        accessManager: '0x1C9909EF68aC870ddb788dcE6955C4AC77A77a4C',
        ordersManager: '0xa9f8Ec6C787208235aEC7C6AF50f1cFCe10319fB',
        perps: '0x6B3cb699940a1A1814c71b8260a01eaC86f26572',
        risexOracle: '0xb588f71d964a8cDBFA0B4c2A918ccb659a6EF2eA',
        risexStork: '0xee01CF24AD96d4734fbBC3EDeF2139D4Fca74D47',
      },
    })
  })

  it('uses the default public mainnet rpc unless env overrides it', () => {
    expect(getDeploymentForEnv('mainnet').chainId).toBe(4153)
    expect(getDeploymentForEnv('mainnet').rpcUrl).toBe('https://rpc.risechain.com')

    const runtime = getRuntimeEnvironment('mainnet', {})

    expect(runtime.rpcUrl).toBe('https://rpc.risechain.com')
  })

  it('lets mainnet rpc come from env without mutating deployment addresses', () => {
    const runtime = getRuntimeEnvironment('mainnet', {
      MAINNET_RPC_URL: 'https://example-mainnet.invalid',
    })

    expect(runtime.rpcUrl).toBe('https://example-mainnet.invalid')
    expect(runtime.addresses.perps).toBe('0x53f10fAcFC8965750494E6965F5d6dA39B41d852')
  })

  it('exposes the USDC quote token per environment', () => {
    expect(getDeploymentForEnv('testnet').addresses.usdc).toBe(getAddress('0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677'))
    expect(getDeploymentForEnv('staging').addresses.usdc).toBe(getAddress('0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677'))
    expect(getDeploymentForEnv('mainnet').addresses.usdc).toBe(getAddress('0xe436820ba0C69702c1d3E601d421c0eF38262739'))
  })
})
