// RISEx domain types, demo fixtures, and raw/friendly converters.

import { mmrPercentToMaintenanceMarginFactor } from "./numbers";

export type EnvKey = "testnet" | "staging" | "mainnet" | "shadow";

export type ExecMode = "eoa" | "safe";

export const ENVS: { key: EnvKey; label: string; mode: ExecMode; chain: string; access: string; safe?: string }[] = [
  { key: "testnet", label: "Testnet",  mode: "eoa",  chain: "RISE Testnet · 11155931", access: "0xAcc3...7A21" },
  { key: "staging", label: "Staging",  mode: "eoa",  chain: "RISE Staging · 11155932", access: "0xAcc4...8B12" },
  { key: "shadow",  label: "Shadow",   mode: "eoa",  chain: "Anvil fork · pre-mainnet", access: "0xAcc5...9D03" },
  { key: "mainnet", label: "Mainnet",  mode: "safe", chain: "RISE Mainnet · 11155930",  access: "0xAcc1...F4D8", safe: "0xSAFE...9C2A" },
];

export const PROTOCOL_PRICE_PRECISION = 8;
export const PROTOCOL_TOKEN_DECIMALS = 18;
export const QUOTE_SYMBOL = "USDC";

export function marketTickerName(symbol: string): string {
  return `${symbol.trim().toUpperCase()}/${QUOTE_SYMBOL}`;
}

export type MarketStatus = "unlocked" | "locked";

export type Market = {
  id: number;
  symbol: string;            // e.g. ETH
  quote: string;             // USDC
  status: MarketStatus;
  deferredSettlement: boolean;
  maxLeverage: number;       // x
  mmrPct: string;            // % decimal string, no JS float math for raw conversion
  mmrRaw: string;            // raw maintenanceMarginFactor
  stepSize: number;          // token units (friendly)
  stepSizeRaw: string;       // raw token base units
  stepPrice: number;         // quote units (friendly) per step
  stepPriceRaw: string;      // raw at price precision 8
  minOrderStep: number;
  maxOrderStep: number;
  oiLimitSteps: number;
  impactBaseUsdc: number;    // friendly USDC
  impactBaseRaw: string;     // raw contract value
  priceBandBps: number;
  deployedAt: string;
};

const mk = (m: Partial<Market> & { id: number; symbol: string }): Market => {
  const stepSize = m.stepSize ?? 1;
  const stepPrice = m.stepPrice ?? 0.00001;
  const mmrPct = m.mmrPct ?? "2.5";
  return {
    status: "unlocked",
    deferredSettlement: true,
    maxLeverage: 20,
    mmrPct,
    mmrRaw: rawMmr(mmrPct),
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
    deployedAt: "2025-09-12",
    ...m,
    quote: QUOTE_SYMBOL,
  } as Market;
};

export const MARKETS_BY_ENV: Record<EnvKey, Market[]> = {
  mainnet: [
    mk({ id: 0, symbol: "ETH",  maxLeverage: 25, mmrPct: "2.0",  stepSize: 0.001, stepPrice: 0.01,    minOrderStep: 1, maxOrderStep: 500000, oiLimitSteps: 5_000_000, impactBaseUsdc: 250, priceBandBps: 150 }),
    mk({ id: 1, symbol: "BTC",  maxLeverage: 25, mmrPct: "1.8",  stepSize: 0.0001, stepPrice: 0.1,    minOrderStep: 1, maxOrderStep: 200000, oiLimitSteps: 3_000_000, impactBaseUsdc: 500, priceBandBps: 120 }),
    mk({ id: 2, symbol: "SOL",  maxLeverage: 20, mmrPct: "2.5",  stepSize: 0.01,   stepPrice: 0.001,  minOrderStep: 5, maxOrderStep: 300000, oiLimitSteps: 4_000_000, impactBaseUsdc: 120, priceBandBps: 200 }),
  ],
  staging: [
    mk({ id: 0, symbol: "ETH",  maxLeverage: 25, mmrPct: "2.0",  stepSize: 0.001, stepPrice: 0.01,    minOrderStep: 1, maxOrderStep: 500000, oiLimitSteps: 5_000_000, impactBaseUsdc: 250, priceBandBps: 150 }),
    mk({ id: 1, symbol: "BTC",  maxLeverage: 25, mmrPct: "1.8",  stepSize: 0.0001, stepPrice: 0.1,    minOrderStep: 1, maxOrderStep: 200000, oiLimitSteps: 3_000_000, impactBaseUsdc: 500, priceBandBps: 120 }),
    mk({ id: 2, symbol: "SOL",  maxLeverage: 20, mmrPct: "2.5",  stepSize: 0.01,   stepPrice: 0.001,  minOrderStep: 5, maxOrderStep: 300000, oiLimitSteps: 4_000_000, impactBaseUsdc: 120, priceBandBps: 200 }),
    mk({ id: 3, symbol: "ARB",  maxLeverage: 15, mmrPct: "3.0",  stepSize: 1,      stepPrice: 0.00001, minOrderStep: 50, maxOrderStep: 500000, oiLimitSteps: 2_000_000, impactBaseUsdc: 60, priceBandBps: 250, status: "locked" }),
    mk({ id: 4, symbol: "DOGE", maxLeverage: 10, mmrPct: "5.0",  stepSize: 10,     stepPrice: 0.000001,minOrderStep: 100, maxOrderStep: 1_000_000, oiLimitSteps: 6_000_000, impactBaseUsdc: 40, priceBandBps: 350, deferredSettlement: true }),
  ],
  testnet: [
    mk({ id: 0, symbol: "ETH",  maxLeverage: 50, mmrPct: "1.0",  stepSize: 0.001, stepPrice: 0.01,    minOrderStep: 1, maxOrderStep: 500000, oiLimitSteps: 5_000_000, impactBaseUsdc: 100, priceBandBps: 300 }),
    mk({ id: 1, symbol: "BTC",  maxLeverage: 50, mmrPct: "1.0",  stepSize: 0.0001, stepPrice: 0.1,    minOrderStep: 1, maxOrderStep: 200000, oiLimitSteps: 3_000_000, impactBaseUsdc: 200, priceBandBps: 300 }),
    mk({ id: 2, symbol: "SOL",  maxLeverage: 30, mmrPct: "2.0",  stepSize: 0.01,   stepPrice: 0.001,  minOrderStep: 5, maxOrderStep: 300000, oiLimitSteps: 4_000_000, impactBaseUsdc: 80, priceBandBps: 300 }),
    mk({ id: 3, symbol: "PEPE", maxLeverage: 10, mmrPct: "8.0",  stepSize: 1000,   stepPrice: 0.00000001, minOrderStep: 100, maxOrderStep: 2_000_000, oiLimitSteps: 10_000_000, impactBaseUsdc: 20, priceBandBps: 500 }),
  ],
  shadow: [
    mk({ id: 0, symbol: "ETH",  maxLeverage: 25, mmrPct: "2.0",  stepSize: 0.001, stepPrice: 0.01,    minOrderStep: 1, maxOrderStep: 500000, oiLimitSteps: 5_000_000, impactBaseUsdc: 250, priceBandBps: 150 }),
    mk({ id: 1, symbol: "BTC",  maxLeverage: 25, mmrPct: "1.8",  stepSize: 0.0001, stepPrice: 0.1,    minOrderStep: 1, maxOrderStep: 200000, oiLimitSteps: 3_000_000, impactBaseUsdc: 500, priceBandBps: 120 }),
    mk({ id: 2, symbol: "SOL",  maxLeverage: 20, mmrPct: "2.5",  stepSize: 0.01,   stepPrice: 0.001,  minOrderStep: 5, maxOrderStep: 300000, oiLimitSteps: 4_000_000, impactBaseUsdc: 120, priceBandBps: 200 }),
  ],
};

// AERO/USDC candidate prefill
export const AERO_TEMPLATE = {
  symbol: "AERO",
  quote: QUOTE_SYMBOL,
  maxLeverage: 10,
  mmrPct: "5.0",
  stepSize: 1,
  stepPrice: 0.00001,
  minOrderStep: 20,
  maxOrderStep: 200000,
  oiLimitSteps: 2_000_000,
  impactBaseUsdc: 50,
  priceBandBps: 300,
  status: "unlocked" as MarketStatus,
  deferredSettlement: true,
};

// Helpers
export function fmt(n: number, max = 8): string {
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

export function rawMmr(pct: string | number) {
  try {
    return mmrPercentToMaintenanceMarginFactor(String(pct)).toString();
  } catch {
    return "invalid";
  }
}
export function rawImpact(usdc: number) { return BigInt(Math.round(usdc * 1e6)).toString(); }
export function rawStepPrice(p: number, precision = PROTOCOL_PRICE_PRECISION) { return BigInt(Math.round(p * 10 ** precision)).toString(); }
export function rawStepSize(s: number, decimals = PROTOCOL_TOKEN_DECIMALS) {
  // emulate token-base-units as scientific bigint
  const s18 = BigInt(Math.round(s * 1e6)) * BigInt(10 ** Math.max(0, decimals - 6));
  return s18.toString();
}
