import { NextResponse, type NextRequest } from 'next/server'

import {
  getRuntimeEnvironment,
  isMarketAdminEnv,
  type MarketAdminEnv,
} from '@/src/config/deployments'
import { createMarketPublicClient } from '@/src/lib/rpc/market-reader'
import { readOracleValidation } from '@/src/lib/rpc/oracle-validation'

export async function GET(request: NextRequest) {
  const envParam = request.nextUrl.searchParams.get('env') ?? 'staging'
  const marketIdParam = request.nextUrl.searchParams.get('marketId')
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim()

  if (!isMarketAdminEnv(envParam)) {
    return NextResponse.json({ error: `unknown environment: ${envParam}` }, { status: 400 })
  }

  const marketId = Number(marketIdParam)
  if (!Number.isInteger(marketId) || marketId < 0 || marketId > 65_535) {
    return NextResponse.json({ error: `invalid marketId: ${marketIdParam}` }, { status: 400 })
  }

  if (!symbol) {
    return NextResponse.json({ error: 'missing symbol' }, { status: 400 })
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
    const validation = await readOracleValidation(
      client,
      {
        risexOracle: deployment.addresses.risexOracle,
        risexStork: deployment.addresses.risexStork,
      },
      marketId,
      symbol,
    )

    return NextResponse.json({
      env: deployment.env,
      oracle: deployment.addresses.risexOracle,
      stork: deployment.addresses.risexStork,
      validation,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed to validate oracle'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
