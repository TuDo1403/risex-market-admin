# RISEx Market Admin Design QA

final result: passed

## Render Evidence

- Ported app: `/Users/tudo/repo/rise/risex-market-admin`
- Desktop render: `/tmp/risex-market-admin-desktop.png`
- Mobile render: `/tmp/risex-market-admin-mobile.png`
- Local URL: `http://127.0.0.1:3107`
- Capture method: Playwright CLI screenshot. Browser/IAB tooling was not exposed in this session.

## Implementation Ledger

- Implemented the market-admin console in the Next.js App Router app as `components/market-admin-console.tsx`.
- Preserved the Vercel-compatible proposal scaffolding from the existing implementation.
- Kept the terminal layout: compact header, RISEx mark, mono typography, dark grid surface, environment selector, market table, operator identity controls, and workflow tabs.
- Adapted imports and CSS tokens for the existing Tailwind v4 Next.js setup.
- Added deterministic render values, avoiding hydration drift.
- Unified execution through AccessManager multicall. Safe App SDK is used when detected; otherwise the connected wallet sends the transaction.
- Replaced market fixtures in the visible console with direct RPC reads of `getTotalMarkets()`, then batched `getMarketConfig(id)` and `getImpactNotionalBaseUsdc(id)` calls through Multicall3.
- Added `OrdersManager.isDeferredMode(protocol, marketId)` to the same Multicall3 batch so deferred settlement is shown separately from market lock state.
- Corrected the perps config ABI to match `IPerpsMarketConfig`: `address quote`, `uint8 maxLeverage`, `uint80 maintenanceMarginFactor`, `uint32` order-step fields, and `uint24 matchPriceBandBps`.
- Verified the canonical Multicall3 address `0xcA11bde05977b3631167028862bE2a173976CA11` has code on the configured RISE testnet RPC.
- Removed editable price precision and token-decimal controls from the market form. Price precision is fixed at 8 for price raw conversion and token decimals are fixed at 18 for token step conversion.
- Changed maintenance-margin entry to keep the friendly percent as a decimal string and derive raw `maintenanceMarginFactor` through exact bigint decimal parsing, not JS floating point math.

## Verified Interactions

- Environment selector switches testnet, staging, and mainnet states.
- Current markets table changes per environment from the live API response and remains scrollable on mobile.
- Market lock and deferred settlement render as separate table fields and editor controls.
- Update editor opens with selected market values prefilled.
- Open-market flow includes the AERO template and friendly/raw value panels.
- Proposal review tab shows decoded call tape and Safe-compatible transaction JSON.
- Safe App SDK is used when the app is embedded in Safe; otherwise the connected wallet sends the AccessManager multicall transaction.
- Validation checks include market config, mark oracle config, and live oracle price freshness before transaction handoff.

## Verification Commands

- `rtk vitest run`
- `rtk tsc --noEmit`
- `rtk lint`
- `npm run build`
- `rtk playwright test`

## Result

The market-admin console is now the primary product shell for `risex-market-admin`, with repo-specific market-admin logic and Vercel-compatible proposal handling retained.
