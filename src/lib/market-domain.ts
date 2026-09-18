// RISEx domain types, demo fixtures, and raw/friendly converters.

import { formatRawDecimal, maintenanceMarginFactorToMmrPercent, parseDecimalToRaw } from "./numbers";
import { getDeploymentForEnv } from "@/src/config/deployments";

export type EnvKey = "testnet" | "staging" | "mainnet";

export const ENVS: { key: EnvKey; label: string; chain: string; access: string }[] = [
  { key: "testnet", label: "Testnet", chain: "RISE Testnet · 11155931", access: getDeploymentForEnv("testnet").addresses.accessManager },
  { key: "staging", label: "Staging", chain: "RISE Staging · 11155931", access: getDeploymentForEnv("staging").addresses.accessManager },
  { key: "mainnet", label: "Mainnet", chain: "RISE Mainnet · 4153", access: getDeploymentForEnv("mainnet").addresses.accessManager },
];

export const PROTOCOL_PRICE_PRECISION = 8;
export const PROTOCOL_TOKEN_DECIMALS = 18;
export const QUOTE_SYMBOL = "USDC";
export const DEFAULT_MARK_ORACLE_CONFIG = {
  timeConstantSeconds: 480,
  minUpdateInterval: 10,
  maxPremiumBps: 50,
};

export function marketTickerName(symbol: string): string {
  return `${symbol.trim().toUpperCase()}/${QUOTE_SYMBOL}`;
}

export type MarketStatus = "unlocked" | "locked";

export type Market = {
  id: number;
  symbol: string;            // e.g. ETH
  quote: string;             // USDC
  status: MarketStatus;
  maxLeverage: number;       // x
  mmr: string;               // maintenance margin the contract stores, as a ×1e18 decimal string
  mmrRaw: string;            // raw maintenanceMarginFactor (what is sent on-chain)
  mmrPct: string;            // derived liquidation ratio, reference only
  stepSize: string | number; // token units (friendly); strings preserve exact 18-decimal values
  stepSizeRaw: string;       // raw token base units
  stepPrice: number;         // quote units (friendly) per step
  stepPriceRaw: string;      // raw at price precision 8
  minOrderStep: number;
  maxOrderStep: number;
  oiLimitSteps: number;
  impactBaseUsdc: number;    // friendly USDC
  impactBaseRaw: string;     // raw contract value
  priceBandBps: number;
  markOracleConfigured: boolean;
  markOracleTimeConstantSeconds: number;
  markOracleMinUpdateInterval: number;
  markOracleMaxPremiumBps: number;
  deployedAt: string;
};

const mk = (m: Partial<Market> & { id: number; symbol: string }): Market => {
  const stepSize = m.stepSize ?? 1;
  const stepPrice = m.stepPrice ?? 0.00001;
  const mmr = m.mmr ?? "40";
  return {
    status: "unlocked",
    maxLeverage: 20,
    mmr,
    mmrRaw: rawMmr(mmr),
    mmrPct: mmrRatioPct(rawMmr(mmr)),
    stepSize,
    stepSizeRaw: rawStepSize(stepSize),
    stepPrice,
    stepPriceRaw: rawStepPrice(stepPrice),
    minOrderStep: 20,
    maxOrderStep: 200000,
    oiLimitSteps: 2000000,
    impactBaseUsdc: 50,
    impactBaseRaw: rawImpact(50),
    priceBandBps: 200,
    markOracleConfigured: true,
    markOracleTimeConstantSeconds: DEFAULT_MARK_ORACLE_CONFIG.timeConstantSeconds,
    markOracleMinUpdateInterval: DEFAULT_MARK_ORACLE_CONFIG.minUpdateInterval,
    markOracleMaxPremiumBps: DEFAULT_MARK_ORACLE_CONFIG.maxPremiumBps,
    deployedAt: "2025-09-12",
    ...m,
    quote: QUOTE_SYMBOL,
  } as Market;
};

export const MARKETS_BY_ENV: Record<EnvKey, Market[]> = {
  mainnet: [
    mk({ id: 1, symbol: "ETH",  maxLeverage: 25, mmr: "50",  stepSize: 0.001, stepPrice: 0.01,    minOrderStep: 1, maxOrderStep: 500000, oiLimitSteps: 5_000_000, impactBaseUsdc: 250, priceBandBps: 150 }),
    mk({ id: 2, symbol: "BTC",  maxLeverage: 25, mmr: "55",  stepSize: 0.0001, stepPrice: 0.1,    minOrderStep: 1, maxOrderStep: 200000, oiLimitSteps: 3_000_000, impactBaseUsdc: 500, priceBandBps: 120 }),
    mk({ id: 3, symbol: "SOL",  maxLeverage: 20, mmr: "40",  stepSize: 0.01,   stepPrice: 0.001,  minOrderStep: 5, maxOrderStep: 300000, oiLimitSteps: 4_000_000, impactBaseUsdc: 120, priceBandBps: 200 }),
  ],
  staging: [
    mk({ id: 1, symbol: "ETH",  maxLeverage: 25, mmr: "50",  stepSize: 0.001, stepPrice: 0.01,    minOrderStep: 1, maxOrderStep: 500000, oiLimitSteps: 5_000_000, impactBaseUsdc: 250, priceBandBps: 150 }),
    mk({ id: 2, symbol: "BTC",  maxLeverage: 25, mmr: "55",  stepSize: 0.0001, stepPrice: 0.1,    minOrderStep: 1, maxOrderStep: 200000, oiLimitSteps: 3_000_000, impactBaseUsdc: 500, priceBandBps: 120 }),
    mk({ id: 3, symbol: "SOL",  maxLeverage: 20, mmr: "40",  stepSize: 0.01,   stepPrice: 0.001,  minOrderStep: 5, maxOrderStep: 300000, oiLimitSteps: 4_000_000, impactBaseUsdc: 120, priceBandBps: 200 }),
    mk({ id: 4, symbol: "ARB",  maxLeverage: 15, mmr: "33",  stepSize: 1,      stepPrice: 0.00001, minOrderStep: 50, maxOrderStep: 500000, oiLimitSteps: 2_000_000, impactBaseUsdc: 60, priceBandBps: 250, status: "locked" }),
    mk({ id: 5, symbol: "DOGE", maxLeverage: 10, mmr: "20",  stepSize: 10,     stepPrice: 0.000001,minOrderStep: 100, maxOrderStep: 1_000_000, oiLimitSteps: 6_000_000, impactBaseUsdc: 40, priceBandBps: 350 }),
  ],
  testnet: [
    mk({ id: 1, symbol: "ETH",  maxLeverage: 50, mmr: "100",  stepSize: 0.001, stepPrice: 0.01,    minOrderStep: 1, maxOrderStep: 500000, oiLimitSteps: 5_000_000, impactBaseUsdc: 100, priceBandBps: 300 }),
    mk({ id: 2, symbol: "BTC",  maxLeverage: 50, mmr: "100",  stepSize: 0.0001, stepPrice: 0.1,    minOrderStep: 1, maxOrderStep: 200000, oiLimitSteps: 3_000_000, impactBaseUsdc: 200, priceBandBps: 300 }),
    mk({ id: 3, symbol: "SOL",  maxLeverage: 30, mmr: "50",  stepSize: 0.01,   stepPrice: 0.001,  minOrderStep: 5, maxOrderStep: 300000, oiLimitSteps: 4_000_000, impactBaseUsdc: 80, priceBandBps: 300 }),
    mk({ id: 4, symbol: "PEPE", maxLeverage: 10, mmr: "12.5",  stepSize: 1000,   stepPrice: 0.00000001, minOrderStep: 100, maxOrderStep: 2_000_000, oiLimitSteps: 10_000_000, impactBaseUsdc: 20, priceBandBps: 500 }),
  ],
};

// AERO/USDC candidate prefill
export const AERO_TEMPLATE = {
  symbol: "AERO",
  quote: QUOTE_SYMBOL,
  maxLeverage: 10,
  mmr: "20",
  stepSize: 1,
  stepPrice: 0.00001,
  minOrderStep: 20,
  maxOrderStep: 200000,
  oiLimitSteps: 2_000_000,
  impactBaseUsdc: 50,
  priceBandBps: 300,
  markOracleTimeConstantSeconds: DEFAULT_MARK_ORACLE_CONFIG.timeConstantSeconds,
  markOracleMinUpdateInterval: DEFAULT_MARK_ORACLE_CONFIG.minUpdateInterval,
  markOracleMaxPremiumBps: DEFAULT_MARK_ORACLE_CONFIG.maxPremiumBps,
  status: "unlocked" as MarketStatus,
};

// Helpers
export function fmt(n: string | number, max = 8): string {
  if (typeof n === "string") return n;
  if (n === 0) return "0";
  if (Math.abs(n) >= 1_000_000) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

export function bigStr(n: number): string {
  if (!isFinite(n)) return "—";
  // produce 1e18-style ints as plain decimal string
  if (n >= 1e15) return BigInt(Math.round(n)).toString();
  return Math.round(n).toString();
}

// The contract stores maintenance margin as a ×1e18 value; that is what operators type.
export function rawMmr(mmr: string | number) {
  try {
    return parseDecimalToRaw(String(mmr), PROTOCOL_TOKEN_DECIMALS).toString();
  } catch {
    return "invalid";
  }
}
export function mmrFromRaw(raw: string) {
  try {
    return formatRawDecimal(BigInt(raw), PROTOCOL_TOKEN_DECIMALS);
  } catch {
    return "0";
  }
}
// Liquidation ratio implied by the maintenance margin — shown for reference, never sent.
export function mmrRatioPct(raw: string) {
  try {
    return maintenanceMarginFactorToMmrPercent(BigInt(raw), PROTOCOL_TOKEN_DECIMALS);
  } catch {
    return "—";
  }
}
export function rawPriceBandBps(percent: string | number) {
  try {
    return parseDecimalToRaw(String(percent), 4).toString();
  } catch {
    return "invalid";
  }
}
export function priceBandBpsToPercent(bps: string | number | bigint) {
  const raw = typeof bps === "bigint" ? bps : BigInt(String(bps));
  return formatRawDecimal(raw, 4);
}
export function rawImpact(usdc: number) {
  if (!Number.isSafeInteger(usdc) || usdc < 0) return "invalid";
  return BigInt(usdc).toString();
}
export function rawStepPrice(p: number, precision = PROTOCOL_PRICE_PRECISION) { return BigInt(Math.round(p * 10 ** precision)).toString(); }
export function rawStepSize(s: string | number, decimals = PROTOCOL_TOKEN_DECIMALS) {
  try {
    return parseDecimalToRaw(String(s), decimals).toString();
  } catch {
    return "invalid";
  }
}
