# RISEx Market Admin Spec

Date: 2026-06-24

## Goal

Build a Vercel-compatible Next.js App Router console for accelerating RISEx perps market listings while keeping proposal review, numeric conversion, shadow execution, and transaction submission auditable.

The target users are protocol developers and business operators. The UI must optimize for exactness: every friendly input has a raw value, every generated transaction is decoded, and submission is blocked until the state machine reaches `readyForExecution`.

## Product Shape

- Current market table: loads live perps markets by calling `getTotalMarkets()` and then `getMarketConfig(id)` for each market id. It must not guess ids from local config order.
- Market draft wizard: supports V1 perps operations for opening, locking/unlocking, updating config, deferred mode, and impact-notional base updates.
- Proposal review: creates shareable, unguessable review links for GitHub-authenticated users. Review pages are read-only by default and show exact draft inputs, raw values, decoded calls, shadow result, validation result, and atomic transaction JSON.
- Shadow preflight: uses `http://shadow-rpc.riselabs.xyz` and executor `0x7CD9460423f9f1751B1F7F1581Aa74d7e4b0984D`. If the RPC is unreachable or execution fails, proposal submission stays blocked.
- Submission: always builds one `AccessManager.multicall` transaction. If opened inside Safe, submit it through Safe Apps SDK; otherwise prompt the connected wallet to send the same transaction.

## Visual System

Source: `rise-bridge/web`.

- Dark terminal surface with cool near-black panels.
- RISEx/Rise icon in first viewport.
- JetBrains Mono for dense data, Inter for body copy.
- Compact operational layout: market table, draft panel, validation tape, proposal JSON.
- Signature element: a "diff tape" that renders the proposal as a terminal log with selector, target, raw value, and post-check status.
- Avoid marketing hero sections. The first screen is the usable console.

## Environments

All addresses are imported into one config module from `risex-contracts/script/data/{testnet,staging,mainnet}/deployment.json`.

| Env | Addresses | Default RPC |
| --- | --- | --- |
| testnet | testnet deployment JSON | `https://testnet.riselabs.xyz` |
| staging | staging deployment JSON | `https://testnet.riselabs.xyz` |
| mainnet | mainnet deployment JSON | `MAINNET_RPC_URL` |
| shadow | mainnet deployment JSON | `http://shadow-rpc.riselabs.xyz` |

## State Machine

`marketDraftMachine` states:

- `idle`
- `loadingDeployments`
- `loadingLiveMarkets`
- `editing`
- `validating`
- `buildingAtomicTx`
- `shadowExecuting`
- `shadowFailed`
- `shadowPassed`
- `creatingReviewLink`
- `readyForExecution`
- `submittingTransaction`
- `submitted`

Guards:

- target env selected
- deployment addresses loaded
- live `getTotalMarkets()` loaded
- next market id still matches live state
- numeric config converts cleanly to raw values
- AccessManager allows each planned selector
- shadow run passed
- authenticated GitHub session exists before saving/review links

Invariant: no UI submission button is enabled unless the machine is in `readyForExecution`.

## Numeric Model

Every field stores the original friendly string and the raw integer:

- MMR percent converts to `maintenanceMarginFactor` by `factor = 1e18 / mmrFraction`.
- bps fields accept bps and percent labels and store integer bps.
- token amount fields accept token decimal strings and store raw steps.
- price tick accepts quote decimal strings and stores raw price units.
- impact base accepts plain USDC and stores `uint64` USDC base amount.

Conversions must reject ambiguous rounding. If a value cannot be represented exactly at the target decimals, validation fails.

## Transactions

V1 open listing flow produces ordered calls:

1. `openMarket(OpenMarketParams)`
2. optional `setDeferredMode(marketId,true)`
3. optional `setImpactNotionalBaseUsdc(marketId,value)`

The builder emits:

- inner tx list
- one `AccessManager.multicall(bytes[])` transaction
- each multicall item is `AccessManager.execute(target, data)` for an inner perps call
- decoded call tape

## Backend

Route handlers:

- `app/api/auth/[...nextauth]/route.ts`: Auth.js GitHub login.
- `app/api/reviews/route.ts`: authenticated create/list review drafts.
- `app/api/reviews/[id]/route.ts`: authenticated read/update/revoke.
- `app/api/shadow/run/route.ts`: authenticated shadow preflight execution.
- `app/r/[shareId]/page.tsx`: read-only review page for any GitHub-authenticated user with link.

Database tables:

- `users`: GitHub id, login, avatar, timestamps.
- `market_reviews`: owner id, share id, env, draft JSON, generated tx JSON, validation result, shadow result, status.
- `review_events`: append-only comments/status changes.

Dev/test can use an in-memory store. Production requires `DATABASE_URL`.

## Test Plan

Implementation order is red-green-refactor:

1. Deployment/env config tests.
2. Numeric conversion tests.
3. State machine transition and guard tests.
4. RPC reader tests with mocked viem client.
5. Atomic AccessManager transaction builder tests.
6. Shadow executor tests.
7. Auth-protected review API tests.
8. Component tests for market table, wizard, raw/friendly toggles, and proposal diff tape.
9. Playwright e2e for mocked GitHub session, draft creation, shadow pass, and atomic submission button enabled.
