# Finding 007 — A native KASH deposit works end to end

**Date:** 2026-09-17
**Status:** executed against a live node.
**Node:** `konstellationd` @ `ace9616`, chain 56670.
**Subject:** `0xbow-io/privacy-pools-core` @ `c312dcd5`.

## The system, deployed on Konstellation

`poc/script/DeployPool.s.sol` stands the whole thing up in one transaction batch —
verifiers, the UUPS proxy, the pool, and registration.

| Component | Address |
|---|---|
| `WithdrawalVerifier` | `0x71725163aa51A55386194A5091448726c2eb237d` |
| `CommitmentVerifier` (ragequit) | `0x6e7B8A754A8a9111F211bC8C8f619E462f8DdF5F` |
| `Entrypoint` implementation | `0x28108934A16e88cAC49dD4A527fe9A87CE526173` |
| **`Entrypoint` (ERC1967 proxy)** | `0xa7F16731951d943768cf2053485b69EF61feF8Be` |
| **`PrivacyPoolSimple`** | `0x53F807E5ff81974642F84A78E725e8cDc756a9CE` |

Pool scope: `12788144232782158643882234856377882519904192354625010089837209104050478186503`

`scopeToPool(scope)` returns the pool address, so registration took. Config:
1 KASH minimum deposit, 0 bps vetting fee, 500 bps max relay fee.

**The UUPS proxy pattern works on Konstellation** — `ERC1967Proxy` deployed,
`initialize` ran through it, and subsequent calls route to the implementation.
That exercises `delegatecall` and ERC-1967 storage slots, neither of which could
be assumed.

## The deposit

```
deposit(uint256 precommitment)  value: 10 KASH
→ status 1, gasUsed 312,013, block 3195
```

Verified after:

| Check | Result |
|---|---|
| Pool native balance | **10.0 KASH** |
| Merkle `currentRoot()` | `1871805627928815330200991885724902890157746203199041811965006804186241082629` |
| Pool `nonce()` | 1 |
| Events | `LeafInserted`, `Deposited` (pool), `Deposited` (entrypoint) |

So the commitment was inserted into the Lean IMT, the root advanced from zero, and
the funds are held by the pool. **This is a working shielded deposit on
Konstellation**, using native KASH with no wrapping.

### Gas, in context

312,013 gas against the 10,000,000 block limit ([003](003-environment-baseline.md))
is **3.1% of a block** — about 32 deposits per block before contending with
ordinary traffic. Comfortably inside the estimate in [006](006-groth16-runs-on-konstellation.md).

## D14's premise, confirmed on chain

The `Deposited` event indexes the depositor:

```
topics[1] = 0x000000000000000000000000c6fe5d33615a1c52c08018c47e8bc53646a0e101
          = dev0, in the clear
```

This is exactly what the threat model §2 says we cannot hide and must document:
**using the pool is public, even though what happens inside it is not.** The
depositor, the amount (10 KASH, in the event data) and the timing are all readable
by anyone.

It also confirms D14's deposit-side enforcement is real: `msg.sender` is the tx
signer, so `x/compliance`'s ante decorator sees a frozen depositor and rejects
before any of this runs. Still to be *executed* against the `x-compliance` binary
— predicted in [004](004-d14-perimeter-analysis.md), not yet observed.

## What is still not proven

- **Withdrawal.** Needs a real Groth16 proof from `packages/circuits`, which needs
  the circuit build (the artifacts that truncated the tarball in
  [002](002-alternative-privacy-pools.md)). This is the remaining half of the
  end-to-end claim, and the half that carries the D14 gap from
  [004](004-d14-perimeter-analysis.md).
- **The relayer**, and with it the gas-linkage gate the threat model §8 calls
  non-negotiable.
- **SDK scanning** — whether a wallet can reconstruct its balance from chain data
  plus keys alone (threat model P4).

Per Appendix A, compatibility is not proven until deposit → transfer → withdraw
succeeds. Half of that now works.
