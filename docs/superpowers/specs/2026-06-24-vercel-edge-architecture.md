# Vercel Edge / Client-First Architecture — Design

Date: 2026-06-24
Status: Approved direction (decisions captured below); supersedes the server-route data
flow in `2026-06-24-wire-console-to-real-backend-design.md`.

## Goal

A near-static Next.js App Router app on Vercel where the **browser talks to RISE RPC
directly**. No custom data API, no auth function, no database. RISE testnet and mainnet
RPCs are non-sensitive, so reads, oracle checks, access checks, and shadow preflight all
run client-side; execution already runs in the wallet.

## Decisions (locked)

1. All chain interaction → client-side; delete the server data routes.
2. Review links → stateless, URL-encoded (no database).

## Topology

```
Browser (Next.js client)
  ├─ viem public client ──► RISE RPC (testnet/mainnet/shadow)   [reads, multicall]
  ├─ wagmi wallet client ──► RISE RPC                            [EOA execution]
  ├─ Safe Apps SDK / JSON artifact                               [mainnet proposals]
  └─ /r/[token] static review page                               [URL-encoded payload]
Static assets + RSC served from Vercel CDN. No DB. No app API.
```

## RPC configuration (non-sensitive, shipped to client)

Hardcode public RPC URLs in `src/config/deployments.ts` so they ship in the client
bundle (acceptable — non-sensitive):

- testnet / staging / shadow: `https://testnet.riselabs.xyz` (shadow may use its own fork
  RPC; keep `shadow.rpcUrl` as-is)
- mainnet: `https://rpc.risechain.com/`

Mainnet `chainId` must be set to its real value (currently a placeholder = testnet id);
confirm before enabling mainnet writes. Allow optional `NEXT_PUBLIC_<ENV>_RPC_URL`
overrides for local dev, read at module load. The server-only `getRuntimeEnvironment`
(reads `process.env`) is no longer used by the client path — the client uses
`getDeploymentForEnv`.

## Reads — move to the client

The existing pure libs already accept a `client` param, so they run unchanged in the
browser. Add a browser client factory and react-query hooks; delete the routes.

- New `src/lib/client/public-client.ts`:
  ```ts
  export function getPublicClient(env: MarketAdminEnv): PublicClient {
    const d = getDeploymentForEnv(env)
    return createPublicClient({
      chain: riseChain(env),                 // viem chain from deployments (id + rpc)
      transport: http(d.rpcUrl),
      batch: { multicall: true },            // enables client.multicall used by readers
    })
  }
  ```
- New read hooks (react-query, already provided by `QueryClientProvider`):
  - `useMarkets(env)` → `readLiveMarkets(getPublicClient(env), perps, { ordersManagerAddress })` then `liveMarketToDisplayMarket`. Replaces `fetch('/api/markets')`.
  - `useOracleValidation(env, marketId, symbol)` → `readOracleValidation(...)`.
  - access check + shadow are called imperatively on demand (not hooks): `checkAccessForCalls(getPublicClient(env), accessManager, caller, innerCalls)` and `executeShadowPreflight({ client: createShadowWalletClient(shadowRpc), executor, perpsAddress, calls })`.
- DELETE: `app/api/markets/route.ts`, `app/api/oracle/validation/route.ts`,
  `app/api/shadow/run/route.ts`, and their `*.route.test.ts`. KEEP the libs
  (`market-reader`, `oracle-validation`, `access-manager`, `shadow`) and their unit tests.

Shadow note: `createShadowWalletClient` uses an impersonated executor account (no private
key), so it works from the browser **iff** the shadow RPC permits unlocked-account sends
and browser CORS.

## Auth

No GitHub auth. Review links are bearer URLs and are readable by anyone with the token.

## Reviews — stateless URL-encoded (no DB)

- New `src/lib/review-link.ts`:
  ```ts
  export type ReviewPayload = {
    env: MarketAdminEnv
    draft: MarketDraft
    proposal: { innerCalls: InnerCall[]; safeTx: SafeTxJson } // hex strings, JSON-safe
    validation?: unknown
    createdAt: string
  }
  export function encodeReview(p: ReviewPayload): string   // JSON -> deflate -> base64url
  export function decodeReview(token: string): ReviewPayload
  ```
  Use the browser/edge-native `CompressionStream('deflate-raw')` + base64url (no new dep),
  or `fflate` (tiny) if a sync API is preferred. Round-trip unit-tested.
- Route: `app/r/[token]/page.tsx` calls `decodeReview(token)` and renders the draft /
  generated tx / validation result. No DB read and no auth check.
- DELETE: `app/api/reviews/route.ts`, `app/api/reviews/[id]/route.ts`,
  `src/lib/server/review-store.ts`, and their tests. Drop the `postgres` dependency and
  `DATABASE_URL`.
- Console "shareable review link": build `token = encodeReview(...)`, set
  `${location.origin}/r/${token}`, copy.
- Size: deflate keeps a typical proposal well under URL limits (~8 KB). If a payload ever
  exceeds that, fall back to a Vercel KV store behind a thin function — out of scope now.

## Console wiring (client, no server data calls)

- Markets table ← `useMarkets(env)`.
- ProposalPanel ← proposal-assembly (client) → real selectors/args/JSON.
- ValidationTape ← numeric parse + client `canCall` + client oracle-validation + wallet
  booleans.
- ShadowPreflight ← client `executeShadowPreflight`.
- Execution ← wagmi EOA (`sendEoaTransactions` with `useWalletClient`) / Safe JSON + SDK.
- Review ← `encodeReview` URL.

## File-level change list

- Delete: `app/api/**`, `src/lib/server/**`, `auth.ts`, and server route tests.
- Add: `src/lib/client/public-client.ts`, `src/lib/client/use-markets.ts` (+ read hooks),
  `src/lib/review-link.ts` (+ test), `app/r/[token]/page.tsx`.
- Modify: `src/config/deployments.ts` (client RPCs + real mainnet rpc/chainId),
  `components/market-admin-console.tsx` (client reads/exec/review), `.env.example`,
  `package.json` (drop backend/auth dependencies).
- Keep: all pure libs, `app/providers.tsx`, `src/lib/wagmi.ts`.

## Vercel project config

- `vercel.ts` (or defaults): framework `nextjs`; no edge override on the auth route.
- No required server env. Remove `DATABASE_URL`, `AUTH_*`, `MAINNET_RPC_URL`,
  `TESTNET_RPC_URL`, `STAGING_RPC_URL`, and `MARKET_ADMIN_TEST_AUTH` from required
  runtime config.

## Risks / verification

1. **RPC CORS** — the browser→RPC calls require `Access-Control-Allow-Origin` from
   `testnet.riselabs.xyz` and `rpc.risechain.com`. Verify with a preflight from a browser
   origin; if blocked, add a minimal per-env Vercel function proxy (still no DB).
2. **Shadow RPC** must be browser-reachable and allow impersonated sends; otherwise keep
   shadow behind a thin function.
3. **Mainnet chainId** is a placeholder in `deployments.ts` — confirm before enabling
   mainnet.
4. **Review token length** — monitor; deflate should keep it small.

## Migration order (when implementing)

1. deployments: real RPCs + mainnet chainId + `riseChain()` helper.
2. `public-client.ts` + `useMarkets` → switch table off `/api/markets`; delete that route.
3. Move oracle-validation + access + shadow to client; delete those routes.
4. `review-link.ts` + `/r/[token]` page; delete reviews routes + postgres store; drop dep.
5. Console: wire review share to `encodeReview`.
6. Trim `.env.example`; verify `typecheck`/`test`/`lint`/`build`; CORS smoke test.
