# Design: Wire the market-admin console to the real backend (remove all mocks)

Date: 2026-06-24
Status: Approved (pending spec review)

## Problem

The RISEx market-admin app has a complete, tested backend (on-chain reads, GitHub
auth, real calldata encoding, EOA/Safe execution, shadow preflight, postgres-backed
review links). The UI component `components/market-admin-console.tsx` ignores almost
all of it: it fakes GitHub sign-in (`setGithub("@rise-ops")`), fakes wallet connect
(`setWallet("0x9F2c…")`), builds string-only proposal args (not calldata), runs a
`setTimeout` shadow simulation, and renders heuristic validation. The
`src/lib/lovable-risex.ts` module it depends on is **incorrect mock math**, not just
fixtures.

Goal: replace the mock layer end-to-end so every surfaced value and action is real —
real GitHub session, real wagmi wallet, real calldata, real access checks, real shadow
runs, real execution, real review links — with **no mock data anywhere**.

## Key findings (verified against `risex-contracts`)

The canonical contract interface
(`risex-contracts/src/interfaces/exchanges/perps/engine/extensions/IPerpsMarketConfig.sol`,
`.../order-book/IOrdersManager.sol`) differs from this repo's `src/lib/abis.ts`:

1. `OpenMarketParams.bookConfig` is `IOrdersManager.Config = { uint64 stepSize; uint64
   stepPrice; }`. This repo's `abis.ts` wrongly declares 7 fields
   (`base, quote, pricePrecision, sizePrecision, tickSize, minSize, maxSize`) → wrong
   calldata. **There is no `base` token address in the params** (resolves the
   "where does base come from" question: it does not exist).
2. `getTotalMarkets()` returns `uint256`; `abis.ts` says `uint16`.
3. `setMarketLock(uint16 marketId, bool unlocked)` — arg is `unlocked` (true = unlock).
   `abis.ts` names it `locked` (inverted semantics) → a real correctness bug for the
   update flow.

The real numeric converters live in `src/lib/numbers.ts` and differ fundamentally from
`lovable-risex.ts`:

- `maintenanceMarginFactor = 100·WAD² / (percent·WAD)` (inverse relationship).
  `lovable-risex.rawMmr = pct·1e16` is wrong.
- `impactNotionalBaseUsdc` is stored in **whole USDC** (50 = 50 USDC); per the contract
  comment. `lovable-risex.rawImpact = usdc·1e6` is wrong.
- **Both `stepSize` and `stepPrice` are 18-decimal (WAD)** — verified against the live
  testnet contract (BTC/USDC market 1: `stepSize=1e12`=0.000001, `stepPrice=1e17`=0.1).
  So `market-view.ts` formatting `stepPrice` at precision-8 is a bug, and
  `tokenDecimals`/`pricePrecision` are NOT scaling inputs — drop both from the editor.
- `matchPriceBandBps` is a raw integer pass-through (uint24); `maxLeverage`/order steps/
  `oiLimitSteps` are plain integers.

### Live-contract verification (testnet)

`getTotalMarkets()` returns `uint256` (31). `getMarketConfig(1)` = `("BTC/USDC", 0x8c49…E677,
true, 50, 7.5e19, 100, 1e9, 0, 1e12, 1e17, 50000)` — confirming name format `<BASE>/USDC`,
quote = USDC, and the WAD scaling above. Deferred state is not on Perps: it is read via
`OrdersManager.isDeferredMode(uint16) → bool`. `market-reader` must read it (zeroed/empty
slots like market 0 stay visible).

Domain rules (from user + `risex-contracts/config/*.toml`, `script/ops/SetupMarkets.s.sol`):

- Quote is always USDC; ticker is always `<SYM>/USDC`. USDC address per env:
  - testnet/staging: `0x8c49BaEeC2Ea2356598Ef33eA5dd52267643E677`
  - mainnet: `0xe436820ba0C69702c1d3E601d421c0eF38262739`
- Price feed IDs are derived (no operator input):
  - `indexPriceId = keccak256(utf8("<SYM>USDC"))`
  - `markPriceId  = keccak256(utf8("<SYM>USDCMARK"))`
- `bookConfig.stepSize/stepPrice` equal `perpsConfig.stepSize/stepPrice` (per
  `SetupMarkets._openMarket`).

## Scope

Full end-to-end (user-approved). Affects: `abis.ts`, `proposal-builder.ts`,
`deployments.ts`, `market-view.ts`, new `price-ids.ts`, new `providers.tsx`, new
`wagmi.ts`, `app/layout.tsx`, `app/page.tsx`, `components/market-admin-console.tsx`,
and tests. Deletes `src/lib/lovable-risex.ts`.

Out of scope: changing the backend API routes, the review store, the shadow lib, or the
authz helper (all already real). No unrelated refactors.

## Components

### 1. Correctness fixes (land first, with tests)

- **`src/lib/abis.ts`**
  - `getTotalMarkets` output `uint256`.
  - `openMarket` `bookConfig` components → `[{name:'stepSize',type:'uint64'},
    {name:'stepPrice',type:'uint64'}]`.
  - `setMarketLock` second input `{name:'unlocked',type:'bool'}`.
- **`src/lib/proposal-builder.ts`**
  - `OrdersBookConfig` → `{ stepSize: bigint; stepPrice: bigint }`; `encodeOpenMarket`
    bookConfig built from those two values.
  - Add `buildUpdateMarketProposal(input)` producing ordered `innerCalls`:
    `updateMarketConfig(marketId, perpsConfig)` (required), then conditional
    `setMarketLock(marketId, unlocked)` when lock state changes,
    `setDeferredMode(marketId, enabled)` when deferred toggled,
    `setImpactNotionalBaseUsdc(marketId, value)` when impact base changes — plus the
    same multiSend/`safeTx` envelope as open.
  - Both builders consume raw `bigint`s; the UI converts friendly→raw via `numbers.ts`.

### 2. Config + derivation

- **`src/config/deployments.ts`**: add `usdc: Address` to `DeploymentAddresses` for all
  envs using the values above.
- **`src/lib/price-ids.ts`** (new, pure, unit-tested): `deriveIndexPriceId(symbol)`,
  `deriveMarkPriceId(symbol)` via viem `keccak256(toHex(...))`. Symbol is the base
  (uppercased), e.g. `AERO`.
- **`src/lib/market-view.ts`**: owns the `Market` display type (moved from
  lovable-risex), reshaped to `status: 'unlocked'|'locked'` + `deferredSettlement:
  boolean` + `mmrPct: string` (no `pricePrecision`/`tokenDecimals`). Fix `stepPrice`
  formatting to 18 decimals (was 8). `LiveMarket` gains `deferredSettlement` read from
  `OrdersManager.isDeferredMode`; `market-reader` takes the ordersManager address.

### 3. Providers

- **`app/providers.tsx`** (new, `'use client'`): composes
  `SessionProvider` (next-auth/react) → `WagmiProvider` → `QueryClientProvider`.
- **`app/layout.tsx`**: wrap `{children}` in `<Providers>`.

### 4. Auth (real GitHub)

- Header consumes `useSession()`; "Sign in" → `signIn('github')`, signed-in chip →
  `signOut()`. Display `session.user.name`/avatar. Review/Safe gating keys off real
  session presence.

### 5. Wallet (wagmi, injected-only)

- Add deps `wagmi`, `@tanstack/react-query`.
- **`src/lib/wagmi.ts`** (new): viem chain objects derived from `deployments.ts`
  (RISE testnet/staging/shadow share chainId 11155931; mainnet placeholder gated on a
  real RPC), `createConfig` with `injected()` connector and matching `http()`
  transports.
- Header "Connect"/"Disconnect" via `useAccount`/`useConnect`/`useDisconnect`. On
  wrong chain, surface `switchChain`. EOA execution uses `useWalletClient()` (viem
  client) fed into the existing `sendEoaTransactions`.

### 6. Panels wired to real data

- **ProposalPanel**: build calls from the real builder for the active mode. Show real
  function names, real 4-byte selectors (`call.data.slice(0,10)`), decoded args, the
  real `multiSendPayload`/`safeTx` JSON, and a Safe Transaction Builder–compatible
  batch JSON for mainnet. All copy buttons copy real content.
- **ValidationTape**: real checks — friendly→raw parse success (numbers.ts),
  next/existing market id, **AccessManager `canCall`** per selector (read via a public
  client with the connected address as caller), shadow status, GitHub session, signer
  (EOA wallet on non-mainnet / GitHub proposer on mainnet).
- **ShadowPreflight**: `POST /api/shadow/run` with the builder's `innerCalls`; render
  the returned status/pre/post. No timers, no fabricated logs.
- **Execution**:
  - non-mainnet: `sendEoaTransactions(walletClient, account, innerCalls)`; show real
    tx hashes; require AccessManager `canCall` to pass.
  - mainnet: produce the real Safe JSON artifact (copy/download); additionally call
    `submitSafeProposal(safeTx)` via `@safe-global/safe-apps-sdk` **only when the
    console detects it is embedded inside Safe{Wallet}** (SDK `getInfo()` resolves).
- **Review link**: `POST /api/reviews` with `{env, draft, generatedTx, validation,
  shadow}`; render the real `/r/<shareId>` URL; gated on session. Removes the fake URL.

### 7. Editor changes

- Open mode: symbol input only for identity; quote fixed to USDC (drop dropdown);
  drop the fake book-sizing/precision fields that aren't real params, AND drop
  `tokenDecimals`/`pricePrecision` entirely (both stepSize and stepPrice are WAD/18-dec,
  so there is no precision input). Keep the real risk/sizing friendly inputs
  (maxLeverage, mmr %, stepSize, stepPrice, min/max order step, oiLimitSteps, impact
  base USDC, price band bps). Status splits into a lock toggle (unlocked/locked) plus a
  separate deferred-settlement toggle.
- Remove the "AERO/USD example" mock prefill (or replace with an empty draft). No mock
  fixtures anywhere.

## Data flow

```
deployments.ts ─┬─> wagmi.ts (chains/transports) ─> WagmiProvider
                ├─> /api/markets (public client) ─> market-view ─> table (already real)
                └─> usdc addr ──────────────┐
editor (friendly) ─ numbers.ts ─> raw bigints ┤
price-ids.ts (symbol -> markId/indexId) ──────┤
                                              v
                            proposal-builder (open|update)
                              ├─ innerCalls ─> /api/shadow/run  (preflight)
                              ├─ innerCalls ─> access-manager.canCall (validation)
                              ├─ innerCalls ─> sendEoaTransactions (non-mainnet exec)
                              └─ safeTx ─────> Safe JSON artifact + SDK-if-embedded
results + draft ─> POST /api/reviews ─> /r/<shareId>
```

## Error handling

- RPC/read failures: table already surfaces `error` state; keep.
- friendly→raw parse errors (numbers.ts throws): block proposal build, show the field
  error in the validation tape; no silent fallback.
- AccessManager `canCall` false: mark validation fail, disable execute.
- wrong chain / no signer / no session: disable the relevant action with a clear chip.
- shadow non-200 (422): show failed status with the returned reason.
- Safe submit outside Safe context: no-op the SDK path, keep the JSON artifact as the
  instruction.

## Testing

- Unit: `price-ids` derivation (golden vectors from `config/testnet.toml`),
  `proposal-builder` open+update calldata (selectors + decoded args), `abis` shape via
  the builder. Extend existing `numbers`/`market-view` tests as needed.
- Component (`market-admin-console.test.tsx`): mock `next-auth/react` (`useSession`,
  `signIn`, `signOut`) and wagmi hooks (`useAccount`, `useConnect`, `useWalletClient`,
  `useDisconnect`); assert real sign-in/connect state transitions, that ProposalPanel
  renders builder-derived selectors, and that execute is gated on access/session.
- Keep existing API route tests green (no backend changes).

## Risks / notes

- The deployed contract version behind the configured addresses is assumed to match
  `risex-contracts` master (the `deployments.ts` `source` files cite it). The `abis.ts`
  fixes are validated against that interface; if a target env runs a divergent build,
  re-verify before mainnet use.
- RISE mainnet RPC is empty in config; mainnet read/exec stays gated until a real
  `MAINNET_RPC_URL` is provided. The Safe JSON artifact is still produced for mainnet.
- `wagmi` + `@tanstack/react-query` are new deps; injected-only keeps the surface small.
```
