# Wire market-admin console to the real backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every mocked path in the market-admin console with the real, already-built backend — real GitHub session, real wagmi wallet, real calldata, real access checks, real shadow runs, real execution, real review links — with no mock data anywhere.

**Architecture:** Pure lib modules do all conversion/encoding (TDD, no React). React composes them. The console is split into focused components under `components/console/` so each is independently testable with mocked `next-auth/react` and `wagmi` hooks. The legacy fixture/domain module with incorrect mock math is deleted; the `Market` display type and env metadata move to real modules.

**Tech Stack:** Next.js 15 App Router, React 19, viem 2, wagmi + @tanstack/react-query (new), next-auth v5, vitest + @testing-library/react.

## Global Constraints

Every task inherits these. Values verified against `risex-contracts` interfaces and the live testnet contract (`0x6B3cb699940a1A1814c71b8260a01eaC86f26572` @ `https://testnet.riselabs.xyz`).

- **Scaling (WAD = 1e18):** `stepSize` and `stepPrice` are BOTH 18-decimal. `maintenanceMarginFactor` uses `numbers.ts` inverse formula. `impactNotionalBaseUsdc` is WHOLE USDC (uint64, `50` = 50 USDC). `matchPriceBandBps`, `maxLeverage`, `minOrderStep`, `maxOrderStep`, `oiLimitSteps` are plain integers passed through.
- **Always use `src/lib/numbers.ts` for friendly↔raw** (`parseDecimalToRaw`, `formatRawDecimal`, `mmrPercentToMaintenanceMarginFactor`, `maintenanceMarginFactorToMmrPercent`, `parseImpactBaseUsdc`, `parseBps`). Never reintroduce ad-hoc converters.
- **Contract facts:** `getTotalMarkets()→uint256`; `openMarket` `bookConfig` is `{uint64 stepSize, uint64 stepPrice}` (NO base/precision/tick fields); `setMarketLock(uint16, bool unlocked)` (true = unlock); deferred read via `OrdersManager.isDeferredMode(uint16)→bool`, write via `setDeferredMode(uint16, bool enabled)`.
- **Domain:** quote is always USDC; market `name` is `"<BASE>/USDC"`; price IDs derived — `indexPriceId = keccak256(utf8("<BASE>USDC"))`, `markPriceId = keccak256(utf8("<BASE>USDCMARK"))`. USDC addresses: testnet/staging `0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677`, mainnet `0xe436820ba0C69702c1d3E601d421c0eF38262739`.
- **No Claude attribution** in any commit message. Commit messages use Conventional Commits. Do not push unless asked.
- **Gating:** non-mainnet → EOA execution via wagmi wallet client; mainnet → real Safe Tx JSON artifact + `submitSafeProposal` only when embedded in Safe{Wallet}. Mainnet read/exec stays disabled while `MAINNET_RPC_URL` is empty.
- After each task: `npm run typecheck` and `npm run test` must pass before commit.

---

## Phase 1 — Pure libraries (repo stays green)

### Task 1: Correct the contract ABIs

**Files:**
- Modify: `src/lib/abis.ts`
- Test: `src/lib/abis.test.ts` (create)

**Interfaces:**
- Produces: `perpsMarketConfigAbi` (corrected), `accessManagerAbi`, `multiSendAbi`, and new `ordersManagerAbi` with `isDeferredMode`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/abis.test.ts
import { describe, expect, it } from 'vitest'
import { toFunctionSelector, getAbiItem } from 'viem'
import { perpsMarketConfigAbi, ordersManagerAbi } from './abis'

describe('contract abis', () => {
  it('getTotalMarkets returns uint256', () => {
    const item = getAbiItem({ abi: perpsMarketConfigAbi, name: 'getTotalMarkets' })
    expect(item?.outputs[0].type).toBe('uint256')
  })

  it('openMarket bookConfig is exactly {stepSize,stepPrice} uint64', () => {
    const item = getAbiItem({ abi: perpsMarketConfigAbi, name: 'openMarket' })
    const params = item!.inputs[0] as { components: { name: string; type: string; components?: unknown[] }[] }
    const book = params.components.find((c) => c.name === 'bookConfig') as { components: { name: string; type: string }[] }
    expect(book.components.map((c) => `${c.name}:${c.type}`)).toEqual(['stepSize:uint64', 'stepPrice:uint64'])
  })

  it('setMarketLock second arg is the unlocked flag', () => {
    const item = getAbiItem({ abi: perpsMarketConfigAbi, name: 'setMarketLock' })
    expect(item!.inputs[1].name).toBe('unlocked')
  })

  it('ordersManager exposes isDeferredMode(uint16)->bool', () => {
    const sel = toFunctionSelector('isDeferredMode(uint16)')
    const item = getAbiItem({ abi: ordersManagerAbi, name: 'isDeferredMode' })
    expect(item).toBeDefined()
    expect(sel.startsWith('0x')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/abis.test.ts`
Expected: FAIL (bookConfig has 7 fields; `ordersManagerAbi` undefined; `getTotalMarkets` is uint16).

- [ ] **Step 3: Edit `src/lib/abis.ts`**

In `perpsMarketConfigAbi`:
- `getTotalMarkets` output: change `{ name: '', type: 'uint16' }` → `{ name: '', type: 'uint256' }`.
- `openMarket` → `params.components` → `bookConfig.components`: replace the 7-field list with:
```ts
components: [
  { name: 'stepSize', type: 'uint64' },
  { name: 'stepPrice', type: 'uint64' },
],
```
- `setMarketLock` second input: change `{ name: 'locked', type: 'bool' }` → `{ name: 'unlocked', type: 'bool' }`.

Append a new export:
```ts
export const ordersManagerAbi = [
  {
    type: 'function',
    name: 'isDeferredMode',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint16' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/abis.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/abis.ts src/lib/abis.test.ts
git commit -m "fix(abis): correct bookConfig, getTotalMarkets, setMarketLock; add ordersManager isDeferredMode"
```

---

### Task 2: Add USDC addresses to deployments

**Files:**
- Modify: `src/config/deployments.ts`
- Test: `src/config/deployments.test.ts`

**Interfaces:**
- Produces: `DeploymentAddresses.usdc: Address` for all envs; exported `TESTNET_RPC_URL`.

- [ ] **Step 1: Write the failing test** (append to `src/config/deployments.test.ts`)

```ts
import { getAddress } from 'viem'
// inside the existing describe:
it('exposes the USDC quote token per environment', () => {
  expect(getDeploymentForEnv('testnet').addresses.usdc).toBe(getAddress('0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677'))
  expect(getDeploymentForEnv('staging').addresses.usdc).toBe(getAddress('0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677'))
  expect(getDeploymentForEnv('mainnet').addresses.usdc).toBe(getAddress('0xe436820ba0C69702c1d3E601d421c0eF38262739'))
})
```

(If `getDeploymentForEnv` is not yet imported in the test file, add it to the existing import from `@/src/config/deployments`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/deployments.test.ts`
Expected: FAIL (`usdc` is undefined).

- [ ] **Step 3: Edit `src/config/deployments.ts`**

- Add to `DeploymentAddresses`: `usdc: Address`.
- Add constants near the others:
```ts
const TESTNET_USDC = getAddress('0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677')
const MAINNET_USDC = getAddress('0xe436820ba0C69702c1d3E601d421c0eF38262739')
```
- Add `usdc: TESTNET_USDC` to `testnet.addresses` and `staging.addresses`.
- Add `usdc: MAINNET_USDC` to `mainnetAddresses`.
- Export the RPC constant for wagmi: change `const TESTNET_RPC_URL` → `export const TESTNET_RPC_URL`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/deployments.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/deployments.ts src/config/deployments.test.ts
git commit -m "feat(deployments): add per-env USDC address and export testnet rpc"
```

---

### Task 3: Price-ID derivation module

**Files:**
- Create: `src/lib/price-ids.ts`
- Test: `src/lib/price-ids.test.ts`

**Interfaces:**
- Produces: `deriveIndexPriceId(baseSymbol: string): Hex`, `deriveMarkPriceId(baseSymbol: string): Hex`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/price-ids.test.ts
import { describe, expect, it } from 'vitest'
import { deriveIndexPriceId, deriveMarkPriceId } from './price-ids'

describe('price id derivation', () => {
  it('matches the on-chain BTC golden vectors from config/testnet.toml', () => {
    expect(deriveIndexPriceId('BTC')).toBe('0x7321ce442e8814b638e0cd241a8838e7d8222a43cbaaca78adcc2337bfa3185d')
    expect(deriveMarkPriceId('BTC')).toBe('0x98848cd117152974f79fb357720f794415ab653bc2c2dd4548395dc2c4123440')
  })

  it('uppercases the symbol', () => {
    expect(deriveIndexPriceId('btc')).toBe(deriveIndexPriceId('BTC'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/price-ids.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/lib/price-ids.ts`**

```ts
import { keccak256, stringToHex, type Hex } from 'viem'

// Mirrors the Solidity derivation in risex-contracts:
//   indexPriceId = keccak256(bytes(string.concat(symbol, "USDC")))
//   markPriceId  = keccak256(bytes(string.concat(symbol, "USDCMARK")))
export function deriveIndexPriceId(baseSymbol: string): Hex {
  return keccak256(stringToHex(`${baseSymbol.toUpperCase()}USDC`))
}

export function deriveMarkPriceId(baseSymbol: string): Hex {
  return keccak256(stringToHex(`${baseSymbol.toUpperCase()}USDCMARK`))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/price-ids.test.ts`
Expected: PASS (if a golden vector mismatches, the canonical source is `risex-contracts/config/testnet.toml` BTC `index_price_id`/`mark_price_id`; copy the exact values).

- [ ] **Step 5: Commit**

```bash
git add src/lib/price-ids.ts src/lib/price-ids.test.ts
git commit -m "feat(price-ids): derive index/mark price ids from base symbol"
```

---

### Task 4: Read deferred-settlement in the market reader

**Files:**
- Modify: `src/lib/rpc/market-reader.ts`
- Modify: `src/lib/rpc/market-reader.test.ts`
- Modify: `app/api/markets/route.ts`

**Interfaces:**
- Consumes: `ordersManagerAbi` (Task 1).
- Produces: `LiveMarket` gains `deferredSettlement: boolean`; `readLiveMarkets(client, perpsAddress, ordersManagerAddress)` (new 3rd arg).

- [ ] **Step 1: Update the failing test** `src/lib/rpc/market-reader.test.ts`

Add `deferredSettlement` to expectations and an `isDeferredMode` branch in the mocked `readContract`. Concretely, in the existing mock client, handle the new call:
```ts
// when functionName === 'isDeferredMode' return a boolean keyed by args[0] (marketId)
if (functionName === 'isDeferredMode') return marketId === 0 // example: market 0 deferred
```
And pass the orders manager address into the call:
```ts
const markets = await readLiveMarkets(client, PERPS, ORDERS_MANAGER)
expect(markets[0].deferredSettlement).toBe(true)
expect(markets[1].deferredSettlement).toBe(false)
```
(Use whatever `PERPS`/market fixtures already exist; add `const ORDERS_MANAGER = '0x...' as Address`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpc/market-reader.test.ts`
Expected: FAIL (3rd arg/`deferredSettlement` missing).

- [ ] **Step 3: Edit `src/lib/rpc/market-reader.ts`**

- Import `ordersManagerAbi`.
- Add `deferredSettlement: boolean` to `LiveMarket`.
- Change signature: `readLiveMarkets(client, perpsAddress: Address, ordersManagerAddress: Address)`.
- Inside the per-market `Promise.all`, add a third read and include it:
```ts
const [config, impactNotionalBaseUsdc, deferredSettlement] = await Promise.all([
  client.readContract({ address: perpsAddress, abi: perpsMarketConfigAbi, functionName: 'getMarketConfig', args: [id] }),
  client.readContract({ address: perpsAddress, abi: perpsMarketConfigAbi, functionName: 'getImpactNotionalBaseUsdc', args: [id] }),
  client.readContract({ address: ordersManagerAddress, abi: ordersManagerAbi, functionName: 'isDeferredMode', args: [id] }),
])
return {
  id,
  ...normalizeMarketConfig(config),
  impactNotionalBaseUsdc: BigInt(impactNotionalBaseUsdc as bigint),
  deferredSettlement: Boolean(deferredSettlement),
}
```

- [ ] **Step 4: Edit `app/api/markets/route.ts`**

Change the call to pass the orders manager address:
```ts
const liveMarkets = await readLiveMarkets(client, deployment.addresses.perps, deployment.addresses.ordersManager)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/rpc/market-reader.test.ts app/api/markets/markets.route.test.ts`
Expected: PASS (update `markets.route.test.ts` mock if it asserts the reader arity).

- [ ] **Step 6: Commit**

```bash
git add src/lib/rpc/market-reader.ts src/lib/rpc/market-reader.test.ts app/api/markets/route.ts app/api/markets/markets.route.test.ts
git commit -m "feat(market-reader): read per-market deferred settlement from OrdersManager"
```

---

### Task 5: Reshape the `Market` display type and fix stepPrice scaling

**Files:**
- Modify: `src/lib/market-view.ts`
- Modify: `src/lib/market-view.test.ts`

**Interfaces:**
- Consumes: `LiveMarket` (Task 4), `numbers.ts`.
- Produces: `export type Market` (the canonical display type) with fields:
  `id:number; symbol:string; quote:string; status:'unlocked'|'locked'; deferredSettlement:boolean; maxLeverage:number; mmrPct:string; mmrRaw:string; stepSize:number; stepSizeRaw:string; stepPrice:number; stepPriceRaw:string; minOrderStep:number; maxOrderStep:number; oiLimitSteps:number; impactBaseUsdc:number; impactBaseRaw:string; priceBandBps:number; deployedAt:string`.

- [ ] **Step 1: Update the test** `src/lib/market-view.test.ts`

The current first case asserts `stepPrice: 0.00001` for `stepPrice: 1_000n` — that is precision-8 and WRONG. Change that case to 18-decimal so the golden stays `0.00001`:
```ts
stepSize: 1_000_000_000_000_000_000n, // 1e18 -> 1
stepPrice: 10_000_000_000_000n,       // 1e13 -> 0.00001 (18-decimal)
// ...
stepSize: 1,
stepSizeRaw: '1000000000000000000',
stepPrice: 0.00001,
stepPriceRaw: '10000000000000',
```
Keep the `deferredSettlement`, `status`, and `mmrPct` string expectations as already written. Ensure the `import type { Market } ...` (if any) points at `./market-view`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/market-view.test.ts`
Expected: FAIL (stepPrice mismatch / type not exported).

- [ ] **Step 3: Edit `src/lib/market-view.ts`**

- Define and export the `Market` type above (remove the old fixture/domain `Market` import).
- Remove `DEFAULT_PRICE_PRECISION`; use 18 for both:
```ts
const WAD_DECIMALS = 18
// ...
stepSize: Number(formatRawDecimal(live.stepSize, WAD_DECIMALS)),
stepSizeRaw: live.stepSize.toString(),
stepPrice: Number(formatRawDecimal(live.stepPrice, WAD_DECIMALS)),
stepPriceRaw: live.stepPrice.toString(),
```
- Set `status: live.unlocked ? 'unlocked' : 'locked'` and `deferredSettlement: live.deferredSettlement` (it is now on `LiveMarket`; `liveMarketToDisplayMarket` reads `live.deferredSettlement ?? false`).
- Keep `mmrPct` via `maintenanceMarginFactorToMmrPercent` with `'0'` fallback when factor is 0.
- Remove `pricePrecision`/`tokenDecimals` from the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/market-view.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/market-view.ts src/lib/market-view.test.ts
git commit -m "fix(market-view): own Market type, 18-decimal stepPrice, deferred + lock split"
```

---

### Task 6: Update proposal-builder (bookConfig + update builder)

**Files:**
- Modify: `src/lib/proposal-builder.ts`
- Modify: `src/lib/proposal-builder.test.ts`

**Interfaces:**
- Consumes: corrected `perpsMarketConfigAbi`, `PerpsMarketConfig`.
- Produces:
  - `OrdersBookConfig = { stepSize: bigint; stepPrice: bigint }`
  - `buildUpdateMarketProposal(input: UpdateMarketProposalInput): OpenMarketProposal`
  - `UpdateMarketProposalInput = { perpsAddress: Address; marketId: number; perpsConfig: PerpsMarketConfig; lockChange?: { unlocked: boolean }; deferredChange?: { enabled: boolean }; impactNotionalBaseUsdc?: bigint }`

- [ ] **Step 1: Write the failing tests** (append to `src/lib/proposal-builder.test.ts`)

```ts
import { decodeFunctionData } from 'viem'
import { buildUpdateMarketProposal } from './proposal-builder'
import { perpsMarketConfigAbi } from './abis'

const PERPS = '0x6B3cb699940a1A1814c71b8260a01eaC86f26572' as const
const cfg = {
  name: 'BTC/USDC', quote: '0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677',
  unlocked: true, maxLeverage: 50n, maintenanceMarginFactor: 75000000000000000000n,
  minOrderStep: 100n, maxOrderStep: 1000000000n, oiLimitSteps: 0n,
  stepSize: 1000000000000n, stepPrice: 100000000000000000n, matchPriceBandBps: 50000n,
} as const

it('builds updateMarketConfig as the first inner call', () => {
  const p = buildUpdateMarketProposal({ perpsAddress: PERPS, marketId: 1, perpsConfig: cfg })
  expect(p.innerCalls).toHaveLength(1)
  expect(p.innerCalls[0].functionName).toBe('updateMarketConfig')
  const decoded = decodeFunctionData({ abi: perpsMarketConfigAbi, data: p.innerCalls[0].data })
  expect(decoded.functionName).toBe('updateMarketConfig')
  expect(decoded.args[0]).toBe(1)
})

it('appends optional lock/deferred/impact calls when requested', () => {
  const p = buildUpdateMarketProposal({
    perpsAddress: PERPS, marketId: 1, perpsConfig: cfg,
    lockChange: { unlocked: false }, deferredChange: { enabled: true }, impactNotionalBaseUsdc: 250n,
  })
  expect(p.innerCalls.map((c) => c.functionName)).toEqual([
    'updateMarketConfig', 'setMarketLock', 'setDeferredMode', 'setImpactNotionalBaseUsdc',
  ])
  const lock = decodeFunctionData({ abi: perpsMarketConfigAbi, data: p.innerCalls[1].data })
  expect(lock.args).toEqual([1, false])
})
```

Also update the EXISTING open-market test: its `bookConfig` input must now be `{ stepSize, stepPrice }` (drop the 7-field object). Use `bookConfig: { stepSize: cfg.stepSize, stepPrice: cfg.stepPrice }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/proposal-builder.test.ts`
Expected: FAIL (`buildUpdateMarketProposal` missing; open-market bookConfig type mismatch).

- [ ] **Step 3: Edit `src/lib/proposal-builder.ts`**

- Replace `OrdersBookConfig` with:
```ts
export type OrdersBookConfig = { stepSize: bigint; stepPrice: bigint }
```
- In `buildOpenMarketProposal`, the `bookConfig` passed to `encodeFunctionData` is now `input.bookConfig` directly (already `{stepSize, stepPrice}`); no change to the call besides the type.
- Extract the multiSend+safeTx envelope into a helper to keep DRY:
```ts
function wrapInnerCalls(innerCalls: InnerCall[]): OpenMarketProposal {
  const packedTransactions = encodeMultiSendTransactions(innerCalls)
  const multiSendPayload = encodeFunctionData({ abi: multiSendAbi, functionName: 'multiSend', args: [packedTransactions] })
  return {
    innerCalls,
    multiSendPayload,
    safeTx: { to: MULTISEND_CALL_ONLY, value: '0', data: multiSendPayload, operation: 1, baseGas: '0', gasPrice: '0', gasToken: ZERO_ADDRESS, refundReceiver: ZERO_ADDRESS, safeTxGas: '0' },
  }
}
```
Use it in `buildOpenMarketProposal` (replace the inline envelope with `return wrapInnerCalls(innerCalls)`).
- Add:
```ts
export type UpdateMarketProposalInput = {
  perpsAddress: Address
  marketId: number
  perpsConfig: PerpsMarketConfig
  lockChange?: { unlocked: boolean }
  deferredChange?: { enabled: boolean }
  impactNotionalBaseUsdc?: bigint
}

export function buildUpdateMarketProposal(input: UpdateMarketProposalInput): OpenMarketProposal {
  const innerCalls: InnerCall[] = [
    {
      to: input.perpsAddress, value: '0', operation: 0, functionName: 'updateMarketConfig',
      data: encodeFunctionData({
        abi: perpsMarketConfigAbi, functionName: 'updateMarketConfig',
        args: [input.marketId, encodePerpsMarketConfig(input.perpsConfig)],
      }),
    },
  ]
  if (input.lockChange) {
    innerCalls.push({
      to: input.perpsAddress, value: '0', operation: 0, functionName: 'setMarketLock',
      data: encodeFunctionData({ abi: perpsMarketConfigAbi, functionName: 'setMarketLock', args: [input.marketId, input.lockChange.unlocked] }),
    })
  }
  if (input.deferredChange) {
    innerCalls.push({
      to: input.perpsAddress, value: '0', operation: 0, functionName: 'setDeferredMode',
      data: encodeFunctionData({ abi: perpsMarketConfigAbi, functionName: 'setDeferredMode', args: [input.marketId, input.deferredChange.enabled] }),
    })
  }
  if (input.impactNotionalBaseUsdc !== undefined) {
    innerCalls.push({
      to: input.perpsAddress, value: '0', operation: 0, functionName: 'setImpactNotionalBaseUsdc',
      data: encodeFunctionData({ abi: perpsMarketConfigAbi, functionName: 'setImpactNotionalBaseUsdc', args: [input.marketId, input.impactNotionalBaseUsdc] }),
    })
  }
  return wrapInnerCalls(innerCalls)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/proposal-builder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/proposal-builder.ts src/lib/proposal-builder.test.ts
git commit -m "feat(proposal-builder): fix bookConfig shape, add update-market proposal"
```

---

### Task 7: Proposal assembly from a friendly draft

**Files:**
- Create: `src/lib/proposal-assembly.ts`
- Test: `src/lib/proposal-assembly.test.ts`

**Interfaces:**
- Consumes: `numbers.ts`, `price-ids.ts`, `proposal-builder.ts`, `Market` (market-view).
- Produces:
```ts
export type MarketDraft = {
  symbol: string; unlocked: boolean; deferredSettlement: boolean
  maxLeverage: number; mmrPct: string; stepSize: string; stepPrice: string
  minOrderStep: number; maxOrderStep: number; oiLimitSteps: number
  impactBaseUsdc: string; priceBandBps: number
}
export function draftToPerpsConfig(draft: MarketDraft, quote: Address): PerpsMarketConfig
export function assembleOpenProposal(a: { perpsAddress: Address; usdc: Address; nextMarketId: number; draft: MarketDraft }): OpenMarketProposal
export function assembleUpdateProposal(a: { perpsAddress: Address; usdc: Address; marketId: number; base: Market; draft: MarketDraft }): OpenMarketProposal
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/proposal-assembly.test.ts
import { describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'
import { assembleOpenProposal, assembleUpdateProposal, draftToPerpsConfig, type MarketDraft } from './proposal-assembly'
import { perpsMarketConfigAbi } from './abis'
import { deriveIndexPriceId } from './price-ids'

const PERPS = '0x6B3cb699940a1A1814c71b8260a01eaC86f26572' as const
const USDC = '0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677' as const

const draft: MarketDraft = {
  symbol: 'AERO', unlocked: true, deferredSettlement: false,
  maxLeverage: 10, mmrPct: '5', stepSize: '1', stepPrice: '0.00001',
  minOrderStep: 20, maxOrderStep: 200000, oiLimitSteps: 2000000,
  impactBaseUsdc: '50', priceBandBps: 300,
}

it('converts friendly draft to raw perps config', () => {
  const c = draftToPerpsConfig(draft, USDC)
  expect(c.name).toBe('AERO/USDC')
  expect(c.quote).toBe(USDC)
  expect(c.stepSize).toBe(1000000000000000000n)   // 1 * 1e18
  expect(c.stepPrice).toBe(10000000000000n)        // 0.00001 * 1e18
  expect(c.matchPriceBandBps).toBe(300n)
})

it('assembles an open proposal with derived price ids and impact call', () => {
  const p = assembleOpenProposal({ perpsAddress: PERPS, usdc: USDC, nextMarketId: 5, draft })
  expect(p.innerCalls[0].functionName).toBe('openMarket')
  const decoded = decodeFunctionData({ abi: perpsMarketConfigAbi, data: p.innerCalls[0].data })
  const params = decoded.args[0] as { markPriceId: string; indexPriceId: string }
  expect(params.indexPriceId).toBe(deriveIndexPriceId('AERO'))
  expect(p.innerCalls.some((c) => c.functionName === 'setImpactNotionalBaseUsdc')).toBe(true)
})

it('assembles an update proposal only with the calls that changed', () => {
  const base = {
    id: 4, symbol: 'AERO', quote: 'USDC', status: 'unlocked', deferredSettlement: false,
    maxLeverage: 10, mmrPct: '5', mmrRaw: '0', stepSize: 1, stepSizeRaw: '0',
    stepPrice: 0.00001, stepPriceRaw: '0', minOrderStep: 20, maxOrderStep: 200000,
    oiLimitSteps: 2000000, impactBaseUsdc: 50, impactBaseRaw: '50', priceBandBps: 300, deployedAt: 'live',
  } as const
  // only lock changes
  const p = assembleUpdateProposal({ perpsAddress: PERPS, usdc: USDC, marketId: 4, base, draft: { ...draft, unlocked: false } })
  expect(p.innerCalls.map((c) => c.functionName)).toEqual(['updateMarketConfig', 'setMarketLock'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/proposal-assembly.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/lib/proposal-assembly.ts`**

```ts
import type { Address } from 'viem'

import type { Market } from './market-view'
import {
  mmrPercentToMaintenanceMarginFactor,
  parseBps,
  parseDecimalToRaw,
  parseImpactBaseUsdc,
} from './numbers'
import { deriveIndexPriceId, deriveMarkPriceId } from './price-ids'
import {
  buildOpenMarketProposal,
  buildUpdateMarketProposal,
  type OpenMarketProposal,
} from './proposal-builder'
import type { PerpsMarketConfig } from './rpc/market-reader'

const WAD_DECIMALS = 18

export type MarketDraft = {
  symbol: string
  unlocked: boolean
  deferredSettlement: boolean
  maxLeverage: number
  mmrPct: string
  stepSize: string
  stepPrice: string
  minOrderStep: number
  maxOrderStep: number
  oiLimitSteps: number
  impactBaseUsdc: string
  priceBandBps: number
}

export function draftToPerpsConfig(draft: MarketDraft, quote: Address): PerpsMarketConfig {
  return {
    name: `${draft.symbol.toUpperCase()}/USDC`,
    quote,
    unlocked: draft.unlocked,
    maxLeverage: BigInt(draft.maxLeverage),
    maintenanceMarginFactor: mmrPercentToMaintenanceMarginFactor(draft.mmrPct),
    minOrderStep: BigInt(draft.minOrderStep),
    maxOrderStep: BigInt(draft.maxOrderStep),
    oiLimitSteps: BigInt(draft.oiLimitSteps),
    stepSize: parseDecimalToRaw(draft.stepSize, WAD_DECIMALS),
    stepPrice: parseDecimalToRaw(draft.stepPrice, WAD_DECIMALS),
    matchPriceBandBps: parseBps(String(draft.priceBandBps), 'bps'),
  }
}

export function assembleOpenProposal(a: {
  perpsAddress: Address
  usdc: Address
  nextMarketId: number
  draft: MarketDraft
}): OpenMarketProposal {
  const perpsConfig = draftToPerpsConfig(a.draft, a.usdc)
  return buildOpenMarketProposal({
    perpsAddress: a.perpsAddress,
    nextMarketId: a.nextMarketId,
    perpsConfig,
    bookConfig: { stepSize: perpsConfig.stepSize, stepPrice: perpsConfig.stepPrice },
    markPriceId: deriveMarkPriceId(a.draft.symbol),
    indexPriceId: deriveIndexPriceId(a.draft.symbol),
    deferredMode: a.draft.deferredSettlement,
    impactNotionalBaseUsdc: parseImpactBaseUsdc(a.draft.impactBaseUsdc),
  })
}

export function assembleUpdateProposal(a: {
  perpsAddress: Address
  usdc: Address
  marketId: number
  base: Market
  draft: MarketDraft
}): OpenMarketProposal {
  const perpsConfig = draftToPerpsConfig(a.draft, a.usdc)
  const nextImpact = parseImpactBaseUsdc(a.draft.impactBaseUsdc)
  const baseUnlocked = a.base.status === 'unlocked'
  return buildUpdateMarketProposal({
    perpsAddress: a.perpsAddress,
    marketId: a.marketId,
    perpsConfig,
    lockChange: baseUnlocked !== a.draft.unlocked ? { unlocked: a.draft.unlocked } : undefined,
    deferredChange:
      a.base.deferredSettlement !== a.draft.deferredSettlement
        ? { enabled: a.draft.deferredSettlement }
        : undefined,
    impactNotionalBaseUsdc: BigInt(a.base.impactBaseUsdc) !== nextImpact ? nextImpact : undefined,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/proposal-assembly.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/proposal-assembly.ts src/lib/proposal-assembly.test.ts
git commit -m "feat(proposal-assembly): build open/update proposals from a friendly draft"
```

---

### Task 8: Environment UI metadata

**Files:**
- Create: `src/lib/env-meta.ts`
- Test: `src/lib/env-meta.test.ts`

**Interfaces:**
- Consumes: `deployments.ts` (`ENVIRONMENTS`, `getDeploymentForEnv`, `MarketAdminEnv`).
- Produces: `type EnvMeta`, `ENV_META: EnvMeta[]`, `getEnvMeta(env): EnvMeta`. `EnvMeta = { key: MarketAdminEnv; label: string; mode: 'eoa'|'safe'; chainLabel: string; accessManager: Address }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/env-meta.test.ts
import { describe, expect, it } from 'vitest'
import { ENV_META, getEnvMeta } from './env-meta'

describe('env metadata', () => {
  it('marks mainnet as safe mode and others as eoa', () => {
    expect(getEnvMeta('mainnet').mode).toBe('safe')
    expect(getEnvMeta('testnet').mode).toBe('eoa')
    expect(getEnvMeta('shadow').mode).toBe('eoa')
  })
  it('exposes one entry per environment with an access-manager address', () => {
    expect(ENV_META).toHaveLength(4)
    for (const e of ENV_META) expect(e.accessManager.startsWith('0x')).toBe(true)
  })
  it('capitalizes labels', () => {
    expect(getEnvMeta('staging').label).toBe('Staging')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/env-meta.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/lib/env-meta.ts`**

```ts
import type { Address } from 'viem'

import {
  ENVIRONMENTS,
  getDeploymentForEnv,
  type MarketAdminEnv,
} from '@/src/config/deployments'

export type EnvMeta = {
  key: MarketAdminEnv
  label: string
  mode: 'eoa' | 'safe'
  chainLabel: string
  accessManager: Address
}

export const ENV_META: EnvMeta[] = ENVIRONMENTS.map((key) => {
  const d = getDeploymentForEnv(key)
  return {
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    mode: key === 'mainnet' ? 'safe' : 'eoa',
    chainLabel: `RISE ${key} · ${d.chainId}`,
    accessManager: d.addresses.accessManager,
  }
})

export function getEnvMeta(env: MarketAdminEnv): EnvMeta {
  const meta = ENV_META.find((e) => e.key === env)
  if (!meta) throw new Error(`unknown env: ${env}`)
  return meta
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/env-meta.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/env-meta.ts src/lib/env-meta.test.ts
git commit -m "feat(env-meta): real per-env UI metadata from deployments"
```

---

### Task 9: wagmi config + dependencies

**Files:**
- Modify: `package.json` (add deps)
- Create: `src/lib/wagmi.ts`
- Test: `src/lib/wagmi.test.ts`

**Interfaces:**
- Produces: `riseTestnet` (viem chain), `wagmiConfig`.

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install wagmi@^2 @tanstack/react-query@^5
```
Expected: `wagmi` and `@tanstack/react-query` added to `dependencies`; `viem` already present (wagmi peer).

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/wagmi.test.ts
import { describe, expect, it } from 'vitest'
import { riseTestnet, wagmiConfig } from './wagmi'

describe('wagmi config', () => {
  it('registers the RISE testnet chain', () => {
    expect(riseTestnet.id).toBe(11155931)
    expect(wagmiConfig.chains.map((c) => c.id)).toContain(11155931)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/wagmi.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 4: Create `src/lib/wagmi.ts`**

```ts
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

import { TESTNET_RPC_URL } from '@/src/config/deployments'

// RISE testnet/staging/shadow all run chainId 11155931; mainnet is a placeholder on the
// same id until a real chain/RPC is provisioned. A single registered chain is enough for
// wallet signing — reads go through /api/markets.
export const riseTestnet = defineChain({
  id: 11155931,
  name: 'RISE Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [TESTNET_RPC_URL] } },
})

export const wagmiConfig = createConfig({
  chains: [riseTestnet],
  connectors: [injected()],
  transports: { [riseTestnet.id]: http(TESTNET_RPC_URL) },
  ssr: true,
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/wagmi.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/wagmi.ts src/lib/wagmi.test.ts
git commit -m "feat(wagmi): injected-only config on the RISE chain"
```

---

## Phase 2 — Providers

### Task 10: App providers (session + wagmi + query)

**Files:**
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `<Providers>` client wrapper.

- [ ] **Step 1: Create `app/providers.tsx`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { WagmiProvider } from 'wagmi'

import { wagmiConfig } from '@/src/lib/wagmi'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  )
}
```

- [ ] **Step 2: Wrap children in `app/layout.tsx`**

Import and wrap:
```tsx
import { Providers } from './providers'
// ...
<body>
  <div className="scanlines" />
  <Providers>
    <div className="page-shell">{children}</div>
  </Providers>
</body>
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run typecheck`
Expected: PASS (no test for the provider shell; it is exercised by the dev server).

- [ ] **Step 4: Commit**

```bash
git add app/providers.tsx app/layout.tsx
git commit -m "feat(app): session + wagmi + query providers"
```

---

## Phase 3 — Console rewrite (split into focused, testable components)

> All console components live in `components/console/`. The shared visual primitives are extracted once and reused. Each component takes plain props (no global state) so it is unit-testable. The top-level `MarketAdminConsole` wires hooks → props.

### Task 11: Extract shared primitives

**Files:**
- Create: `components/console/primitives.tsx`

**Interfaces:**
- Produces: `Chip`, `Btn`, `Dot`, `Field`, `RiseLogo` — copied verbatim from the current `components/market-admin-console.tsx` (lines for `RiseLogo`, `Dot`, `Chip`, `Btn`, `Field`). `Field` keeps its `mode: 'friendly'|'raw'` signature.

- [ ] **Step 1: Create `components/console/primitives.tsx`**

Add `'use client'` at top, then move the `RiseLogo`, `Dot`, `Chip`, `Btn`, and `Field` function components out of `market-admin-console.tsx` verbatim, exporting each (`export function Chip(...)`, etc.). Keep the `import { cn } from '@/src/lib/utils'` and the lucide imports they need.

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS (the file is standalone; consumers wire up in later tasks).

- [ ] **Step 3: Commit**

```bash
git add components/console/primitives.tsx
git commit -m "refactor(console): extract shared primitives"
```

---

### Task 12: Header with real auth + wallet

**Files:**
- Create: `components/console/Header.tsx`
- Test: `components/console/Header.test.tsx`

**Interfaces:**
- Consumes: `useSession`/`signIn`/`signOut` (next-auth/react), `useAccount`/`useConnect`/`useDisconnect` (wagmi), `getEnvMeta`/`ENV_META`, primitives.
- Produces: `<Header env setEnv />` — reads auth/wallet from hooks directly. Sign-in button label "Sign in"; connect button label "Connect"; when connected shows truncated address with a "Disconnect" action; when signed in shows the GitHub login with a "Sign out" action. Keeps the existing env switcher (`role="group" aria-label="Environment"`, per-env buttons named `Environment <Label>`).

- [ ] **Step 1: Write the failing test**

```tsx
// components/console/Header.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Header } from './Header'

const signIn = vi.fn()
const connect = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: (...a: unknown[]) => signIn(...a),
  signOut: vi.fn(),
}))
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useConnect: () => ({ connect, connectors: [{ uid: '1', name: 'Injected' }] }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}))

afterEach(() => vi.clearAllMocks())

it('calls signIn(github) when Sign in is clicked', async () => {
  render(<Header env="staging" setEnv={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
  expect(signIn).toHaveBeenCalledWith('github')
})

it('calls wagmi connect when Connect is clicked', async () => {
  render(<Header env="staging" setEnv={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /connect/i }))
  expect(connect).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/console/Header.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `components/console/Header.tsx`**

```tsx
'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { ChevronDown, Github, Plug, Shield, Wallet, Zap, Check, Hash } from 'lucide-react'
import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

import type { MarketAdminEnv } from '@/src/config/deployments'
import { ENV_META, getEnvMeta } from '@/src/lib/env-meta'
import { cn } from '@/src/lib/utils'
import { Btn, Chip, Dot, RiseLogo } from './primitives'

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function EnvSwitcher({ env, setEnv }: { env: MarketAdminEnv; setEnv: (e: MarketAdminEnv) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = getEnvMeta(env)
  return (
    <div className="relative" role="group" aria-label="Environment">
      <button
        aria-label={`Environment ${cfg.label}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 h-8 px-2.5 border border-border-strong bg-surface-2 hover:bg-surface-3 rounded-sm"
      >
        <Dot color={`env-${env}`} pulse />
        <span className="font-mono text-[12px] tracking-wide">{cfg.label}</span>
        <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground">{cfg.mode === 'safe' ? 'SAFE' : 'EOA'}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-40 w-72 panel rounded-sm shadow-2xl">
            <div className="panel-header"><span className="panel-title">Environment</span></div>
            <div>
              {ENV_META.map((e) => (
                <button key={e.key} onClick={() => { setEnv(e.key); setOpen(false) }}
                  className={cn('w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border last:border-b-0 flex items-start gap-2', env === e.key && 'bg-surface-2')}>
                  <Dot color={`env-${e.key}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px]">{e.label}</span>
                      <span className={cn('font-mono text-[9px] px-1 rounded-sm border', e.mode === 'safe' ? 'border-destructive/40 text-destructive bg-destructive/10' : 'border-primary/40 text-primary bg-primary/10')}>
                        {e.mode === 'safe' ? 'SAFE PROPOSAL' : 'EOA TX'}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{e.chainLabel}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/70 truncate">AM {e.accessManager}</div>
                  </div>
                  {env === e.key && <Check className="h-3 w-3 text-primary mt-1" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function Header({ env, setEnv }: { env: MarketAdminEnv; setEnv: (e: MarketAdminEnv) => void }) {
  const cfg = getEnvMeta(env)
  const { data: session } = useSession()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const login = session?.user?.name ?? session?.user?.email ?? null

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-4 h-auto py-2 sm:h-12 sm:py-0">
        <RiseLogo />
        <span className="hidden md:inline text-muted-foreground/40 font-mono text-xs">/</span>
        <div className="font-mono text-[12px] tracking-wide">market-admin</div>

        <div className="hidden lg:flex items-center gap-2 ml-2">
          <Chip tone="muted"><Hash className="h-3 w-3" /> {cfg.chainLabel}</Chip>
          <Chip tone={cfg.mode === 'safe' ? 'destructive' : 'primary'}>
            {cfg.mode === 'safe' ? <Shield className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {cfg.mode === 'safe' ? 'Safe MultiSend' : 'EOA Execute'}
          </Chip>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {login ? (
            <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 h-8 px-2 border border-border bg-surface-2 hover:bg-surface-3 rounded-sm">
              <Github className="h-3.5 w-3.5" /><span className="font-mono text-[11px]">{login}</span>
            </button>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => signIn('github')}>
              <Github className="h-3 w-3" /> Sign in
            </Btn>
          )}
          {isConnected && address ? (
            <button onClick={() => disconnect()} className="inline-flex items-center gap-1.5 h-8 px-2 border border-border bg-surface-2 hover:bg-surface-3 rounded-sm">
              <Wallet className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-[11px]">{short(address)}</span>
            </button>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => connect({ connector: connectors[0] })} disabled={!connectors[0]}>
              <Plug className="h-3 w-3" /> Connect
            </Btn>
          )}
          <EnvSwitcher env={env} setEnv={setEnv} />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/console/Header.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/console/Header.tsx components/console/Header.test.tsx
git commit -m "feat(console): header with real GitHub auth and wagmi wallet"
```

---

### Task 13: Markets table (live data, presentational)

**Files:**
- Create: `components/console/MarketsTable.tsx`
- Test: `components/console/MarketsTable.test.tsx`

**Interfaces:**
- Consumes: `Market` (market-view), `LoadState`, primitives.
- Produces: `<MarketsTable env markets selectedId onSelect onOpenEditor loadState error onRefresh />`. `LoadState = 'loading'|'error'|'empty'|'ok'`. Renders `<SYM>/<quote>`, status pill (`unlocked`/`locked`), a `deferred` chip when `deferredSettlement`, and the numeric columns from `Market`. No fake block-number footer, no `getTotalMarkets()` jargon.

- [ ] **Step 1: Write the failing test**

```tsx
// components/console/MarketsTable.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarketsTable } from './MarketsTable'
import type { Market } from '@/src/lib/market-view'

const m: Market = {
  id: 1, symbol: 'BTC', quote: 'USDC', status: 'unlocked', deferredSettlement: false,
  maxLeverage: 50, mmrPct: '1.33', mmrRaw: '0', stepSize: 0.000001, stepSizeRaw: '0',
  stepPrice: 0.1, stepPriceRaw: '0', minOrderStep: 100, maxOrderStep: 1000000000,
  oiLimitSteps: 0, impactBaseUsdc: 0, impactBaseRaw: '0', priceBandBps: 50000, deployedAt: 'live',
}

it('renders a live market row', () => {
  render(<MarketsTable env="testnet" markets={[m]} selectedId={null} onSelect={vi.fn()} onOpenEditor={vi.fn()} loadState="ok" onRefresh={vi.fn()} />)
  expect(screen.getByText('BTC/USDC')).toBeInTheDocument()
})

it('shows an empty message when there are no markets', () => {
  render(<MarketsTable env="testnet" markets={[]} selectedId={null} onSelect={vi.fn()} onOpenEditor={vi.fn()} loadState="empty" onRefresh={vi.fn()} />)
  expect(screen.getByText(/no markets on testnet/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/console/MarketsTable.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `components/console/MarketsTable.tsx`**

Port the current `MarketsTable` and `StatusPill` from `market-admin-console.tsx`, with these changes: import `Market` from `@/src/lib/market-view`; `StatusPill` handles only `'unlocked'|'locked'`; add a small `deferred` chip in the status cell when `m.deferredSettlement`; drop the fake footer entirely; keep the search/refresh/loading/empty/error states (already cleaned). Export `MarketsTable` and the `LoadState` type.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/console/MarketsTable.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/console/MarketsTable.tsx components/console/MarketsTable.test.tsx
git commit -m "feat(console): live markets table component"
```

---

### Task 14: Market editor (friendly draft, no precision fields)

**Files:**
- Create: `components/console/MarketEditor.tsx`
- Test: `components/console/MarketEditor.test.tsx`

**Interfaces:**
- Consumes: `MarketDraft` (proposal-assembly), `numbers.ts` for raw previews, primitives.
- Produces: `<MarketEditor mode draft setDraft base rawMode setRawMode />`. `mode: 'open'|'update'`. Fields: symbol (disabled on update), lock toggle (unlocked/locked), deferred toggle, maxLeverage, mmrPct, stepSize, stepPrice, minOrderStep, maxOrderStep, oiLimitSteps, impactBaseUsdc, priceBandBps. No quote dropdown, no pricePrecision/tokenDecimals. Raw previews come from `numbers.ts` (e.g. `parseDecimalToRaw(draft.stepSize, 18)`), wrapped in try/catch to show `—` on invalid input. Quote is shown as a static `USDC` label.

- [ ] **Step 1: Write the failing test**

```tsx
// components/console/MarketEditor.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MarketEditor } from './MarketEditor'
import type { MarketDraft } from '@/src/lib/proposal-assembly'

const draft: MarketDraft = {
  symbol: 'AERO', unlocked: true, deferredSettlement: false, maxLeverage: 10, mmrPct: '5',
  stepSize: '1', stepPrice: '0.00001', minOrderStep: 20, maxOrderStep: 200000,
  oiLimitSteps: 2000000, impactBaseUsdc: '50', priceBandBps: 300,
}

it('shows the WAD raw preview for step size (18 decimals)', () => {
  render(<MarketEditor mode="open" draft={draft} setDraft={vi.fn()} base={null} rawMode setRawMode={vi.fn()} />)
  expect(screen.getAllByText((_t, n) => n?.textContent?.includes('1000000000000000000') ?? false).length).toBeGreaterThan(0)
})

it('disables the symbol input in update mode', () => {
  render(<MarketEditor mode="update" draft={draft} setDraft={vi.fn()} base={null} rawMode={false} setRawMode={vi.fn()} />)
  expect(screen.getByLabelText(/Market name/i)).toBeDisabled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/console/MarketEditor.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `components/console/MarketEditor.tsx`**

Port the current `MarketEditor`/`DiffRow` but:
- State is `MarketDraft` (strings for numeric-with-decimals fields: mmrPct, stepSize, stepPrice, impactBaseUsdc; numbers for integer fields).
- Replace `rawMmr/rawImpact/rawStepSize/rawStepPrice` previews with `numbers.ts` calls inside a `safeRaw(fn)` helper returning `'—'` on throw:
```ts
function safeRaw(fn: () => bigint): string { try { return fn().toString() } catch { return '—' } }
// e.g. stepSize raw: safeRaw(() => parseDecimalToRaw(draft.stepSize, 18))
//      mmr raw:      safeRaw(() => mmrPercentToMaintenanceMarginFactor(draft.mmrPct))
//      impact raw:   safeRaw(() => parseImpactBaseUsdc(draft.impactBaseUsdc))
```
- Identity column: market-name input (disabled when `mode==='update'`), static `Quote: USDC` text (no select), lock toggle (`unlocked`/`locked` two-button group bound to `draft.unlocked`), deferred toggle (on/off bound to `draft.deferredSettlement`). Remove price-precision/token-decimals inputs.
- Diff (update mode): rows for status (unlocked/locked), deferred, maxLeverage, mmrPct, stepSize, stepPrice, minOrderStep, maxOrderStep, oiLimitSteps, impact base, priceBandBps, comparing `base` (Market) to `draft`.
- Remove the "AERO/USD example" prefill button (mock). Optionally add a "Clear" button that resets to an empty draft.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/console/MarketEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/console/MarketEditor.tsx components/console/MarketEditor.test.tsx
git commit -m "feat(console): editor producing a real friendly draft"
```

---

### Task 15: Proposal hook + panel (real calldata)

**Files:**
- Create: `components/console/use-proposal.ts`
- Create: `components/console/ProposalPanel.tsx`
- Test: `components/console/ProposalPanel.test.tsx`

**Interfaces:**
- Consumes: `assembleOpenProposal`/`assembleUpdateProposal` (proposal-assembly), `getDeploymentForEnv`, `getEnvMeta`, `Market`, primitives.
- Produces:
  - `use-proposal.ts`: `useProposal({ env, mode, draft, base, marketCount }): { proposal: OpenMarketProposal | null; error: string | null }` — calls the assembler in a try/catch so invalid drafts surface as `error` instead of throwing.
  - `ProposalPanel.tsx`: `<ProposalPanel env mode proposal error onExecute onCreateReview canExecute canReview isSafe />` — renders real `functionName`, real selector (`call.data.slice(0,10)`), decoded args summary, the real `multiSendPayload`/`safeTx` JSON (mainnet) or per-tx list (EOA). Copy buttons copy real content via `navigator.clipboard.writeText`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/console/ProposalPanel.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProposalPanel } from './ProposalPanel'
import { assembleOpenProposal, type MarketDraft } from '@/src/lib/proposal-assembly'
import { getDeploymentForEnv } from '@/src/config/deployments'

const draft: MarketDraft = {
  symbol: 'AERO', unlocked: true, deferredSettlement: false, maxLeverage: 10, mmrPct: '5',
  stepSize: '1', stepPrice: '0.00001', minOrderStep: 20, maxOrderStep: 200000,
  oiLimitSteps: 2000000, impactBaseUsdc: '50', priceBandBps: 300,
}
const d = getDeploymentForEnv('testnet')
const proposal = assembleOpenProposal({ perpsAddress: d.addresses.perps, usdc: d.addresses.usdc, nextMarketId: 5, draft })

it('renders real call names and selectors', () => {
  render(<ProposalPanel env="testnet" mode="open" proposal={proposal} error={null} isSafe={false} canExecute={false} canReview={false} onExecute={vi.fn()} onCreateReview={vi.fn()} />)
  expect(screen.getByText('openMarket')).toBeInTheDocument()
  expect(screen.getByText(proposal.innerCalls[0].data.slice(0, 10))).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/console/ProposalPanel.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Create `components/console/use-proposal.ts`**

```ts
import { useMemo } from 'react'

import { getDeploymentForEnv, type MarketAdminEnv } from '@/src/config/deployments'
import type { Market } from '@/src/lib/market-view'
import {
  assembleOpenProposal,
  assembleUpdateProposal,
  type MarketDraft,
} from '@/src/lib/proposal-assembly'
import type { OpenMarketProposal } from '@/src/lib/proposal-builder'

export function useProposal(args: {
  env: MarketAdminEnv
  mode: 'open' | 'update'
  draft: MarketDraft
  base: Market | null
  marketCount: number
}): { proposal: OpenMarketProposal | null; error: string | null } {
  const { env, mode, draft, base, marketCount } = args
  return useMemo(() => {
    const d = getDeploymentForEnv(env)
    try {
      if (mode === 'open') {
        return {
          proposal: assembleOpenProposal({
            perpsAddress: d.addresses.perps,
            usdc: d.addresses.usdc,
            nextMarketId: marketCount,
            draft,
          }),
          error: null,
        }
      }
      if (!base) return { proposal: null, error: 'Select a market to update.' }
      return {
        proposal: assembleUpdateProposal({
          perpsAddress: d.addresses.perps,
          usdc: d.addresses.usdc,
          marketId: base.id,
          base,
          draft,
        }),
        error: null,
      }
    } catch (e) {
      return { proposal: null, error: e instanceof Error ? e.message : 'invalid draft' }
    }
  }, [env, mode, draft, base, marketCount])
}
```

- [ ] **Step 4: Create `components/console/ProposalPanel.tsx`**

Port the current `ProposalPanel` JSX shell but drive it from the real `proposal` prop:
- Header chip: Safe vs EOA from `isSafe`; call count = `proposal.innerCalls.length`.
- Per call: `#i`, `call.functionName`, `optional` chip when not the first call, and the real selector `call.data.slice(0, 10)`; a working copy button (`navigator.clipboard.writeText(call.data)`).
- Safe view: `<pre>` of `JSON.stringify(proposal.safeTx, null, 2)` plus a "copy" button; EOA view: per-tx rows `tx{i+1} {functionName} → {accessManager or perps target}` (use `call.to`).
- Footer actions: `shareable review link` (calls `onCreateReview`, disabled unless `canReview`); `create Safe proposal` (mainnet, disabled unless `canExecute`) OR `execute N tx` (non-mainnet, disabled unless `canExecute`) → `onExecute`.
- When `proposal === null`, render `error` (or "Fill the editor to build a proposal.").

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/console/ProposalPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/console/use-proposal.ts components/console/ProposalPanel.tsx components/console/ProposalPanel.test.tsx
git commit -m "feat(console): real calldata proposal hook and panel"
```

---

### Task 16: Validation tape (real checks incl. AccessManager)

**Files:**
- Create: `components/console/ValidationTape.tsx`
- Test: `components/console/ValidationTape.test.tsx`

**Interfaces:**
- Consumes: `proposal` (`OpenMarketProposal | null`), `error` (draft error), session/wallet booleans, `accessResults` (from `checkAccessForCalls`), primitives.
- Produces: `<ValidationTape env mode proposal draftError hasSession hasWallet accessResults marketCount />`. Checks: numeric validity (`proposal != null && draftError == null`), next/existing market id, AccessManager (`accessResults.allowed`), GitHub session, signer. No fake selector strings.

- [ ] **Step 1: Write the failing test**

```tsx
// components/console/ValidationTape.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ValidationTape } from './ValidationTape'

it('flags numeric validity as failed when there is a draft error', () => {
  render(<ValidationTape env="testnet" mode="open" proposal={null} draftError="too many decimal places for 18 decimals" hasSession={false} hasWallet={false} accessResults={null} marketCount={3} />)
  expect(screen.getByText(/numeric/i)).toBeInTheDocument()
  expect(screen.getByText(/too many decimal places/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/console/ValidationTape.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `components/console/ValidationTape.tsx`**

Port the current `ValidationTape` but build `items` from real inputs:
- `numeric`: `s = proposal && !draftError ? 'ok' : 'fail'`; detail = `draftError ?? 'calldata encodes'`.
- `id`: `ok`; detail = open → `next id ${marketCount}` / update → `matched`.
- `access`: from `accessResults` — `null` → `pending` ("connect wallet to check"); else `accessResults.allowed ? 'ok' : 'fail'` with the failing function names in detail.
- `gh`: `hasSession ? 'ok' : 'fail'`.
- `signer`: mainnet → `hasSession ? 'ok' : 'warn'`; else `hasWallet ? 'ok' : 'fail'`.
Keep the icon mapping (`ok/warn/fail/pending`). Title "Validation".

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/console/ValidationTape.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/console/ValidationTape.tsx components/console/ValidationTape.test.tsx
git commit -m "feat(console): real validation tape with access-manager check"
```

---

### Task 17: Shadow preflight (real API)

**Files:**
- Create: `components/console/ShadowPreflight.tsx`
- Test: `components/console/ShadowPreflight.test.tsx`

**Interfaces:**
- Consumes: `proposal` (`OpenMarketProposal | null`), primitives, `fetch('/api/shadow/run')`.
- Produces: `<ShadowPreflight proposal marketCount mode />` — on "run on shadow", POSTs `{ calls: proposal.innerCalls }` and renders the returned `{ status, pre, post }` (no setTimeout, no fabricated tx logs). Disabled when `proposal == null`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/console/ShadowPreflight.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShadowPreflight } from './ShadowPreflight'

const proposal = { innerCalls: [{ to: '0x'.padEnd(42, '0'), value: '0', data: '0xabcdef12', operation: 0, functionName: 'openMarket' }], multiSendPayload: '0x', safeTx: {} } as never

afterEach(() => vi.unstubAllGlobals())

it('posts the inner calls and renders the returned status', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'passed', pre: 3, post: 4 }) })))
  render(<ShadowPreflight proposal={proposal} marketCount={3} mode="open" />)
  await userEvent.click(screen.getByRole('button', { name: /run on shadow/i }))
  await waitFor(() => expect(screen.getByText(/healthy|passed/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/console/ShadowPreflight.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `components/console/ShadowPreflight.tsx`**

```tsx
'use client'

import { Check, Loader2, Zap } from 'lucide-react'
import { useState } from 'react'

import type { OpenMarketProposal } from '@/src/lib/proposal-builder'
import { Btn, Chip } from './primitives'

type ShadowResult = { status: 'passed' | 'failed'; pre?: number; post?: number; error?: string }

export function ShadowPreflight({ proposal, marketCount, mode }: { proposal: OpenMarketProposal | null; marketCount: number; mode: 'open' | 'update' }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ShadowResult | null>(null)
  const pre = marketCount
  const post = mode === 'open' ? pre + 1 : pre

  async function run() {
    if (!proposal) return
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/shadow/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ calls: proposal.innerCalls }),
      })
      setResult((await res.json()) as ShadowResult)
    } catch (e) {
      setResult({ status: 'failed', error: e instanceof Error ? e.message : 'shadow run failed' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="panel-title">Shadow preflight</span>
        <div className="flex items-center gap-1.5">
          {result?.status === 'passed' && <Chip tone="primary"><Check className="h-3 w-3" /> healthy</Chip>}
          <Btn size="sm" variant={result ? 'outline' : 'primary'} disabled={!proposal || running} onClick={run}>
            {running ? <><Loader2 className="h-3 w-3 animate-spin" /> running</> : <><Zap className="h-3 w-3" /> run on shadow</>}
          </Btn>
        </div>
      </div>
      {!result && !running && (
        <div className="p-3 text-[11px] font-mono text-muted-foreground">
          Forks current state, replays the proposal, and reads post-state.
        </div>
      )}
      {result && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border border-border bg-surface-2 rounded-sm py-2"><div className="text-[9px] uppercase font-mono text-muted-foreground">pre · markets</div><div className="font-mono text-[16px]">{result.pre ?? pre}</div></div>
            <div className="border border-border bg-surface-2 rounded-sm py-2"><div className="text-[9px] uppercase font-mono text-muted-foreground">delta</div><div className="font-mono text-[16px] text-primary">{mode === 'open' ? '+1' : 'Δ config'}</div></div>
            <div className="border border-border bg-surface-2 rounded-sm py-2"><div className="text-[9px] uppercase font-mono text-muted-foreground">post · markets</div><div className="font-mono text-[16px]">{result.post ?? post}</div></div>
          </div>
          <div className={result.status === 'passed' ? 'font-mono text-[11px] text-primary' : 'font-mono text-[11px] text-destructive'}>
            {result.status === 'passed' ? '✓ shadow run passed' : `✗ ${result.error ?? 'shadow run failed'}`}
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/console/ShadowPreflight.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/console/ShadowPreflight.tsx components/console/ShadowPreflight.test.tsx
git commit -m "feat(console): real shadow preflight via /api/shadow/run"
```

---

### Task 18: Compose the console + execution + reviews; delete the mock module

**Files:**
- Rewrite: `components/market-admin-console.tsx`
- Modify: `components/market-admin-console.test.tsx`
- Delete: legacy fixture/domain module, if still present.

**Interfaces:**
- Consumes: all Phase-3 components, `useProposal`, `useWalletClient`/`useAccount`/`useSwitchChain` (wagmi), `useSession`, `sendEoaTransactions` (wallet-eoa), `submitSafeProposal` (safe-app), `checkAccessForCalls` (access-manager) + `createMarketPublicClient` (market-reader), `createPublicClient`.
- Produces: `MarketAdminConsole({ initialEnv })` default export — fetches markets, holds open/update drafts, runs access check when wallet + proposal present, executes (EOA non-mainnet; Safe JSON + SDK-if-embedded on mainnet), creates review links.

- [ ] **Step 1: Rewrite `components/market-admin-console.tsx`**

Top-level component responsibilities (compose, don't re-implement):
```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createPublicClient, http, type Address } from 'viem'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import { useSession } from 'next-auth/react'

import { ENVIRONMENTS, getDeploymentForEnv, getEnvMeta, type MarketAdminEnv } from '@/src/config/deployments'
import type { Market } from '@/src/lib/market-view'
import type { MarketDraft } from '@/src/lib/proposal-assembly'
import { checkAccessForCalls, type AccessCheckResult } from '@/src/lib/access-manager'
import { sendEoaTransactions } from '@/src/lib/wallet-eoa'
import { submitSafeProposal } from '@/src/lib/safe-app'
import { riseTestnet } from '@/src/lib/wagmi'
import { Header } from './console/Header'
import { MarketsTable, type LoadState } from './console/MarketsTable'
import { MarketEditor } from './console/MarketEditor'
import { ValidationTape } from './console/ValidationTape'
import { ShadowPreflight } from './console/ShadowPreflight'
import { ProposalPanel } from './console/ProposalPanel'
import { useProposal } from './console/use-proposal'
```
Behavior:
- `markets` fetched from `/api/markets?env=` (keep the existing effect + `MarketsState`).
- `emptyDraft()` returns a `MarketDraft` with sensible blank/default values (symbol `''`, `unlocked: true`, `deferredSettlement: false`, numbers `0`/strings `''`). `fromMarket(m: Market): MarketDraft` maps a row into a draft (symbol, unlocked = status==='unlocked', deferredSettlement, maxLeverage, mmrPct, stepSize/stepPrice as `String(...)`, integer fields, impactBaseUsdc `String(...)`, priceBandBps).
- Tabs: `current | open | update` (no `review` tab).
- `mode` = `update` when tab==='update' else `open`; pick `openDraft`/`updateDraft`.
- `const { proposal, error: draftError } = useProposal({ env, mode, draft, base, marketCount: markets.length })`.
- AccessManager check (effect): when `proposal && address`, build a read client `createPublicClient({ transport: http(getDeploymentForEnv(env).rpcUrl) })` and call `checkAccessForCalls(client, getEnvMeta? accessManager, address, proposal.innerCalls)`; store `accessResults: { allowed, results } | null`. Reset to `null` when no wallet/proposal.
- `isSafe = env === 'mainnet'`. `canReview = !!session`. `canExecute`:
  - non-mainnet: `isConnected && accessResults?.allowed === true && !!proposal`.
  - mainnet: `!!session && !!proposal` (Safe path).
- `onExecute`:
  - non-mainnet: ensure chain (`if (chainId !== riseTestnet.id) await switchChainAsync({ chainId: riseTestnet.id })`), then `await sendEoaTransactions(walletClient, address, proposal.innerCalls)`; surface tx hashes in local state shown in the panel.
  - mainnet: always offer the JSON (panel already shows it); attempt `await submitSafeProposal(proposal.safeTx)` inside try/catch — if it rejects (not embedded), set a note "Import the Safe JSON into Safe{Wallet}". 
- `onCreateReview`: `POST /api/reviews` with `{ env, draft, generatedTx: proposal, validation: { accessResults }, shadow: {} }`; on 201 set `shareUrl = \`/r/${json.shareId}\`` shown in the panel.
- Layout: status bar (env badge, access, last refresh — no blink), tabs, and the same grid: table; editor; right column = ValidationTape + ShadowPreflight + ProposalPanel. No footer.

- [ ] **Step 2: Delete the mock module**

Run:
```bash
git rm <legacy-fixture-domain-module>
```

- [ ] **Step 3: Rewrite `components/market-admin-console.test.tsx`**

- Replace imports from the legacy fixture/domain module with `type { Market } from '@/src/lib/market-view'` and `type { MarketAdminEnv } from '@/src/config/deployments'` (alias as `EnvKey`).
- Mock `next-auth/react` (`useSession` returns unauthenticated by default; `signIn`/`signOut` spies) and `wagmi` (`useAccount`, `useConnect`, `useDisconnect`, `useWalletClient`, `useSwitchChain`).
- Update the `market(...)` factory to the new `Market` shape (already partially done: `status`, `deferredSettlement`, `mmrPct: string`, no precision fields) — remove `stepPriceRaw` precision-8 assumptions if asserted.
- Rewrite the four scenarios to the real UI:
  1. env switch still changes the table (`DOGE/USDC` → `PEPE/USDC`).
  2. double-click a row opens the update editor (`Update Market … #4 DOGE/USDC`, step fields prefilled, `updateMarketConfig` appears in the proposal).
  3. open tab → editor shows USDC quote label and WAD raw previews (assert `raw: 1000000000000000000` for stepSize `1`).
  4. mainnet shows "Safe MultiSend" and the execute button is gated on session; non-mainnet shows "EOA" and is gated on wallet connect (drive via the mocked hooks: flip `useAccount` to connected and assert enabled).

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npm run typecheck && npm run test`
Expected: PASS (all unit + component + route tests green).

- [ ] **Step 5: Commit**

```bash
git add components/market-admin-console.tsx components/market-admin-console.test.tsx
git commit -m "feat(console): compose real console, wire execution and reviews, drop mock module"
```

---

### Task 19: End-to-end smoke + lint

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: 0 errors, 0 warnings. Fix any unused imports left from the rewrite.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds (SSR + client providers compile).

- [ ] **Step 3: Manual smoke (documented, optional if no creds)**

With `.env` containing `AUTH_GITHUB_ID/SECRET`, `AUTH_SECRET`, `TESTNET_RPC_URL`:
`npm run dev` → load console → markets load live → "Sign in" runs GitHub OAuth → "Connect" opens the injected wallet → switch to testnet → build an update proposal on a row → "run on shadow" returns a status → "execute" sends EOA txs. (Mainnet stays gated until `MAINNET_RPC_URL` is set; the Safe JSON renders.)

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(console): lint and build cleanup"
```

---

## Self-review notes

- **Spec coverage:** correctness fixes (Task 1, 5, 6); USDC/derivation (Tasks 2, 3, 7); deferred read (Task 4); auth (Tasks 10, 12); wagmi (Tasks 9, 10, 12); real panels (Tasks 13–17); execution + reviews + delete mocks (Task 18); Safe JSON+SDK-if-embedded (Task 18 `onExecute`). All spec sections map to a task.
- **No placeholders:** every code step shows real code; component ports reference exact source functions to move.
- **Type consistency:** `Market` (market-view) and `MarketDraft` (proposal-assembly) names are used identically across Tasks 5, 7, 13–18; `OpenMarketProposal` is the shared proposal type for open and update; `LoadState` defined in Task 13 and reused in Task 18.
