import type { LiveMarket } from '@/src/lib/rpc/market-reader'
import { PROTOCOL_PRICE_PRECISION, PROTOCOL_TOKEN_DECIMALS, QUOTE_SYMBOL, type Market } from '@/src/lib/lovable-risex'
import { formatRawDecimal, maintenanceMarginFactorToMmrPercent } from '@/src/lib/numbers'

export function liveMarketToDisplayMarket(live: LiveMarket): Market {
  const [baseFromName] = live.name.split('/')
  const mmrPercent =
    live.maintenanceMarginFactor > 0n
      ? maintenanceMarginFactorToMmrPercent(live.maintenanceMarginFactor, 18)
      : '0'
  const impactBaseUsdc = live.impactNotionalBaseUsdc ?? 0n

  return {
    id: live.id,
    symbol: baseFromName || live.name,
    quote: QUOTE_SYMBOL,
    status: live.unlocked ? 'unlocked' : 'locked',
    deferredSettlement: live.deferredSettlement ?? false,
    maxLeverage: Number(live.maxLeverage),
    mmrPct: mmrPercent,
    mmrRaw: live.maintenanceMarginFactor.toString(),
    stepSize: Number(formatRawDecimal(live.stepSize, PROTOCOL_TOKEN_DECIMALS)),
    stepSizeRaw: live.stepSize.toString(),
    stepPrice: Number(formatRawDecimal(live.stepPrice, PROTOCOL_PRICE_PRECISION)),
    stepPriceRaw: live.stepPrice.toString(),
    minOrderStep: Number(live.minOrderStep),
    maxOrderStep: Number(live.maxOrderStep),
    oiLimitSteps: Number(live.oiLimitSteps),
    impactBaseUsdc: Number(impactBaseUsdc),
    impactBaseRaw: impactBaseUsdc.toString(),
    priceBandBps: Number(live.matchPriceBandBps),
    deployedAt: 'live',
  }
}
