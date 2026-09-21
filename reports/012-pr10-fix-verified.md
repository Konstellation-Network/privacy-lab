# Finding 012 — The EVM fix is verified on merged `main`

**Date:** 2026-09-21
**Status:** closed. [011](011-pr10-breaks-evm-txs.md) is resolved.

## What happened

PR #10 merged 2026-09-17 at `452cdb2`, after `f63c1b7` ("x/compliance/ante: stop
rejecting every EVM tx (PR #10 re-review, HIGH)").

The fix is the one recommended in 011: drop the `ValidateBasic` call, keep the
`recover()` beneath it. `InvolvedAddresses` now opens straight into the deferred
recover.

A regression test was added — `TestInvolvedAddresses_EVMTxWithoutCosmosSignatures`
in `ante_test.go`, which is the unit-level version of the gap 011 described.

## Verified live

On a node built from `a9051f6` (current `main`), the exact transaction that failed
on `ab66ba3`:

| Check | `ab66ba3` | `a9051f6` |
|---|---|---|
| EVM transfer | `error -32000: no signatures supplied` | **`status 1`, block 17** |
| Compliance precompile `isFrozen` | — | responds `false` |

## Also landed while this was open

PR #12, Phase 3 safety rails, merged as `a9051f6`. `x/` now holds **two** modules:

```
x/compliance
x/ratelimit
```

That is a change to the shape `ENGINEERING.md §6.1` describes ("a near-empty `x/`
is the success signal") and to D9's audit surface. Not this spike's call, but
worth noting it moved.

## Effect on the spike

The D14 perimeter test is **unblocked** — `x/compliance` is on `main`, so a pool
can be deployed on a compliance-enabled chain without a worktree build. The
ordering agreed earlier (relayer first, then perimeter) still stands; the
perimeter test is no longer waiting on anyone.
