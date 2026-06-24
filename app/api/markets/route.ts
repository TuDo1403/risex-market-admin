import { NextResponse, type NextRequest } from 'next/server'

import {
  getRuntimeEnvironment,
  isMarketAdminEnv,
  type MarketAdminEnv,
} from '@/src/config/deployments'
import { liveMarketToDisplayMarket } from '@/src/lib/market-view'
import { createMarketPublicClient, readLiveMarkets } from '@/src/lib/rpc/market-reader'

export async function GET(request: NextRequest) {
  const envParam = request.nextUrl.searchParams.get('env') ?? 'staging'

  if (!isMarketAdminEnv(envParam)) {
    return NextResponse.json({ error: `unknown environment: ${envParam}` }, { status: 400 })
  }

  const deployment = getRuntimeEnvironment(envParam as MarketAdminEnv)
  if (!deployment.rpcUrl) {
    return NextResponse.json(
      { error: `missing RPC URL for ${deployment.env}` },
      { status: 503 },
    )
  }

  try {
    const client = createMarketPublicClient(deployment)
    const liveMarkets = await readLiveMarkets(client, deployment.addresses.perps, {
      multicall3Address: deployment.multicall3Address,
      ordersManagerAddress: deployment.addresses.ordersManager,
    })

    return NextResponse.json({
      env: deployment.env,
      chainId: deployment.chainId,
      perps: deployment.addresses.perps,
      source: deployment.source,
      markets: liveMarkets.map(liveMarketToDisplayMarket),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed to read live markets'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
