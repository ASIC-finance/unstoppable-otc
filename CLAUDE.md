# Repository guidance for AI agents

This file documents the conventions that govern the codebase. Follow them
unless explicit user instructions say otherwise.

The repo has two halves:

- `contracts/` — Solidity contracts with Foundry + Hardhat tests
- `frontend/` — React + wagmi + viem DApp

## Frontend architecture

### Transaction lifecycle — `useTx`

Every write to a contract goes through `src/hooks/useTx.ts`. It wraps
`useWriteContract` + `useWaitForTransactionReceipt` and surfaces a
discriminated `status` state:

```
'idle' → 'signing' → 'pending' → 'success' | 'reverted'
```

Specialized hooks (`useCreateOrder`, `useFillOrder`, `useCancelOrder`,
`useCreatePair`, `useTokenAllowance`) are thin wrappers around `useTx` that
supply the `label` used in toasts.

**Never call `useWriteContract` directly in UI code.** Always go through a
hook that composes `useTx`, so error parsing, explorer deep-links, and
toasts stay consistent.

### Error translation — `src/lib/errors.ts`

`parseContractError(unknown)` is the single funnel for turning
wagmi/viem errors into a presentable `{ title, message, errorName,
userRejected }` shape. It:

- Walks the BaseError cause chain to find the underlying revert.
- Detects `UserRejectedRequestError` so we classify wallet dismissals
  correctly (they're not "errors" we toast with red UI).
- Maps known custom errors (`ZeroAmount`, `ExceedsRemaining`, `NotMaker`,
  `ERC20InsufficientAllowance`, …) onto friendly copy.

When you add a new custom error to a contract, add a case in
`humanizeContractError` at the same time.

### Toasts — `src/lib/toast.ts`

The toast store is a tiny external store (`useSyncExternalStore`) with no
runtime dependencies. Three entry points:

- `toast.success(title, message?, action?)`
- `toast.error(title, message?, action?)`
- `toast.pending(id, …)` — sticky toast; must be dismissed explicitly or
  replaced via `toast.update(id, …)`.

`useTx` uses a stable id `tx-${hash}` for the pending toast, then dismisses
and replaces it with a success/error toast when the receipt lands.

### RPC reads — multicall first

`useTokenInfo` and `usePairTokens` use `useReadContracts` (multicall3) so
each token / pair needs one round-trip instead of three or two. Whenever
you need to read more than one piece of data from the same contract in the
same render, batch with `useReadContracts`.

### Error boundaries

`App.tsx` wraps the whole tree in `ErrorBoundary`, and the `<Suspense>` for
the lazy routes is wrapped in a second `ErrorBoundary`. Never add a
try/catch around a render path — let the boundary handle it.

### Lazy routes

`App.tsx` lazy-loads `OrderBook`, `CreateOrder`, and `MyOrders` via
`React.lazy`. Keep this in place — `@reown/appkit` is a ~2.4 MB chunk, and
these splits keep secondary routes out of the first-paint bundle.

### Addresses

- `ZERO_ADDRESS` lives in `src/utils/address.ts`. Don't inline the literal.
- Use `isSameAddress(a, b)` for EVM equality comparisons.
- After `isAddress(s)` you can cast to `` `0x${string}` ``; prefer this over
  `as` casts at other boundaries.

### Chain support

`src/config/chains.ts` is the single source of truth. `getFactoryAddress`
returns `undefined` when the factory hasn't been deployed on the current
chain; the `WrongChainBanner` component handles the UX for that case.

### Tests

- Place test files next to source as `*.test.ts` / `*.test.tsx`.
- Use `@testing-library/react` for component tests — queries by role /
  accessible name, not CSS selectors.
- `src/test/setup.ts` wires jest-dom and cleanup.
- Vitest runs via its own Vite (`vitest.config.ts`) so the Tailwind plugin
  doesn't slow every test run.

## Contracts

- Solidity 0.8.28, OpenZeppelin 5.x.
- Use `Math.mulDiv(…, Math.Rounding.Ceil)` for any price math that must
  round in favor of the maker.
- Every fee-on-transfer path uses the balance-diff pattern.
- Pair-local state lives on the pair itself; the factory only tracks pair
  existence. A malicious token can only affect its own pair.
- Custom errors only — never `require(..., "string")`, never `assert()`.

### Test layout

- Foundry fuzz tests in `contracts/test/foundry/` (256 runs).
- Hardhat unit tests in `contracts/test/`.
- Both run on every PR.

## Doing tasks as an AI agent

- When touching write hooks, run the affected flow through `useTx`.
- When adding a new custom error in a contract, update
  `humanizeContractError` and the frontend ABI files in the same change.
- For UI changes, use the `preview_*` tools (never Bash) to verify.
- Never add untyped `any`. If the ABI inference is unwieldy, narrow
  explicitly via the helpers in `src/types/orders.ts`.
- Keep files under ~200 lines. Split by responsibility when they grow —
  the `components/create-order/` folder is the model.
