# Finding 006 — Groth16 verification runs on Konstellation

**Date:** 2026-09-17
**Status:** executed against a live node. This is the P0-A feasibility core.
**Node:** `konstellationd` @ `ace9616`, chain 56670, JSON-RPC 8545.
**Subject:** `0xbow-io/privacy-pools-core` @ `c312dcd5`.

## Result

Both Groth16 verifiers deployed to Konstellation and **verification executes
correctly**.

| Contract | Address | Deploy gas | On-chain size |
|---|---|---|---|
| `WithdrawalVerifier` | `0x3D641a2791533B4A0000345eA8d509d01E1ec301` | 474,090 | 1,947 bytes |
| `CommitmentVerifier` | `0x07Aa076883658B7ED99D25b1E6685808372C8fE2` | 395,267 | 1,582 bytes |

Both receipts `status: 0x1`. On-chain bytecode is byte-identical to the local
build artifacts.

### The verification itself

```
verifyProof([0,0], [[0,0],[0,0]], [0,0], [0,...,0])  →  false
gas: 26,352
```

Returning `false` is the correct answer for an all-zero proof. **It did not
revert** — the contract ran its elliptic-curve arithmetic to completion and
returned a value.

Confirmed independently at the precompile:

```
eth_call 0x08 (ecPairing), empty input  →  0x...01   (true)
```

`0x08` is the pairing check Groth16 verification depends on. It is present and
behaves per spec.

## Why this is the result that mattered

The privacy strategy §13 lists "assuming EVM compatibility implies compatibility"
as the top risk, and the threat model's §8 exists because EVM-compatible does not
mean every opcode and precompile behaves identically. For a ZK system the specific
worry is the `alt_bn128` precompiles at `0x06`, `0x07`, `0x08` — without them no
Groth16 verifier works, and a chain can be EVM-compatible in every other respect
and still fail here.

They work. **The single largest technical unknown in the integrate path is
resolved.**

## Gas, against the real limit

Block gas limit is 10,000,000 (finding 003).

| Operation | Gas | Share of a block |
|---|---|---|
| Verifier deployment (one-off) | ~474k | 4.7% |
| `verifyProof` (zero proof) | 26,352 | 0.26% |

The 26k figure is a **floor, not the real cost**: an all-zero proof fails the
field checks early. A genuine proof runs the full pairing — expect a few hundred
thousand gas once wrapped in a deposit or withdrawal that also writes state and
moves value. Even at 600k that is 6% of a block, and roughly 16 operations per
block before contending with ordinary traffic.

**Gas is not a feasibility problem on Konstellation.** Throughput under load is a
separate question this spike does not answer.

## Scope of the claim

This proves the *verifier* runs. It does not yet prove:

- a full deposit → withdraw cycle works (needs `Entrypoint` + pool deployed and
  wired, and a real proof from the circuits)
- the D14 perimeter behaves as [004](004-d14-perimeter-analysis.md) predicts
  (needs the `x-compliance` binary, built but not yet run)
- anything about the relayer or the SDK's scanning

Per the strategy's Appendix A: compatibility is not "proven" until an end-to-end
flow succeeds. This is strong evidence, not that proof.
