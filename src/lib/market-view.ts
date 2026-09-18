import type { LiveMarket } from '@/src/lib/rpc/market-reader'
import {
  DEFAULT_MARK_ORACLE_CONFIG,
  PROTOCOL_TOKEN_DECIMALS,
  QUOTE_SYMBOL,
  type Market,
} from '@/src/lib/market-domain'
import { formatRawDecimal, maintenanceMarginFactorToMmrPercent } from '@/src/lib/numbers'

export function liveMarketToDisplayMarket(live: LiveMarket): Market {
  const [baseFromName] = live.name.split('/')
  const mmrPercent =
    live.maintenanceMarginFactor > 0n
      ? maintenanceMarginFactorToMmrPercent(live.maintenanceMarginFactor, PROTOCOL_TOKEN_DECIMALS)
      : '0'
  const impactBaseUsdc = live.impactNotionalBaseUsdc ?? 0n
  const markOracle = live.markOracleConfig
  const markOracleConfigured =
    markOracle !== undefined &&
    markOracle.timeConstantSeconds >= 10n &&
    markOracle.maxPremiumBps > 0n

  return {
    id: live.id,
    symbol: baseFromName || live.name,
    quote: QUOTE_SYMBOL,
    status: live.unlocked ? 'unlocked' : 'locked',
    maxLeverage: Number(live.maxLeverage),
    mmr: formatRawDecimal(live.maintenanceMarginFactor, PROTOCOL_TOKEN_DECIMALS),
    mmrRaw: live.maintenanceMarginFactor.toString(),
    mmrPct: mmrPercent,
    // On-chain stepSize and stepPrice are both WAD-scaled (1e18), verified against
    // the live contract (BTC/USDC: stepPrice 1e17 = $0.1). They are NOT price-feed
    // precision (8); using that here mis-scales stepPrice by 1e10.
    stepSize: formatRawDecimal(live.stepSize, PROTOCOL_TOKEN_DECIMALS),
    stepSizeRaw: live.stepSize.toString(),
    stepPrice: Number(formatRawDecimal(live.stepPrice, PROTOCOL_TOKEN_DECIMALS)),
    stepPriceRaw: live.stepPrice.toString(),
    minOrderStep: Number(live.minOrderStep),
    maxOrderStep: Number(live.maxOrderStep),
    oiLimitSteps: Number(live.oiLimitSteps),
    impactBaseUsdc: Number(impactBaseUsdc),
    impactBaseRaw: impactBaseUsdc.toString(),
    priceBandBps: Number(live.matchPriceBandBps),
    markOracleConfigured,
    markOracleTimeConstantSeconds: markOracleConfigured
      ? Number(markOracle.timeConstantSeconds)
      : DEFAULT_MARK_ORACLE_CONFIG.timeConstantSeconds,
    markOracleMinUpdateInterval: markOracleConfigured
      ? Number(markOracle.minUpdateInterval)
      : DEFAULT_MARK_ORACLE_CONFIG.minUpdateInterval,
    markOracleMaxPremiumBps: markOracleConfigured
      ? Number(markOracle.maxPremiumBps)
      : DEFAULT_MARK_ORACLE_CONFIG.maxPremiumBps,
    deployedAt: 'live',
  }
}
