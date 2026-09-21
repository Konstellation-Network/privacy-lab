# Finding 014 — The gas-linkage gate passes

**Date:** 2026-09-21
**Status:** **the threat model's non-negotiable gate is cleared.**
**Node:** `konstellationd` from `main` @ `a9051f6`, chain 56670.
**Subject:** `0xbow-io/privacy-pools-core` @ `c312dcd5`, relayer + SDK.

## What was tested

Threat model §4 ranks gas linkage **critical** and §8 makes it a gate: a
withdrawal where the recipient funds their own gas relinks the fresh address to
its owner publicly. The cryptography is irrelevant if the first spend gives it
away.

So the test is not "does a withdrawal work" — [010](010-withdrawal-works.md)
already showed that. It is: **can value reach an address that never transacts?**

Flow (`poc/relayer/relayed-withdraw.mjs`): dev0 deposits 10 KASH → ASP root
published → real Groth16 proof generated via the SDK → proof POSTed to the
relayer → **the relayer submits the withdrawal**.

## Result: PASS

On-chain state afterwards:

| Account | Balance | Nonce | Reading |
|---|---|---|---|
| **Recipient (dev2)** | 100,003.96 KASH | **0** | received 3.96 KASH, **never sent a transaction** |
| Relayer (dev1) | 100,000.04 KASH | 1 | submitted the tx, earned 0.04 KASH |
| Depositor (dev0) | 99,979.00 KASH | 12 | funded the deposit |

Pool balance moved 10 → 6 KASH: 4 withdrawn, of which 3.96 to the recipient and
0.04 to the relayer — exactly the 100 bps configured in
[013](013-relayer-runs.md).

**Nonce 0 on the recipient is the whole result.** It had never transacted before
the test and still has not. Nothing links it to the depositor through a funding
transaction, because no funding transaction exists.

## Why this clears the gate and what it does not cover

**Cleared:** value reaches a fresh address that pays no gas and sends nothing.
The relayer pays, and is compensated from the withdrawn amount inside the same
transaction.

**Not covered:**

- **The relayer knows the recipient.** It decodes `RelayData` to submit. So it
  is a trusted party for *recipient* metadata — it cannot see the depositor or
  link the two, but it does learn "someone withdrew to X". The threat model §3
  should carry a relayer row; it currently does not.
- **One relayer is a single point.** A production deployment wants several, or
  the relayer becomes both a liveness dependency and a metadata chokepoint.
- **Timing.** The relayer submits promptly, so shield/unshield timing
  correlation (§4) is untouched by this.

## A limitation of the test script, recorded honestly

`relayed-withdraw.mjs` builds a shadow Merkle tree assuming it is the only
depositor, so a second run against the same pool fails:

```
ERROR: state root mismatch: chain 168863953703392020551403930965576183126757642696... vs shadow 205244615620945375587396290625757167873791471127...
```

That is the script, not the protocol — the pool's tree had two leaves by then
while the shadow had one. A real wallet reconstructs the tree by scanning
`LeafInserted` events (threat model P4, still untested). Re-running needs a fresh
pool, which `poc/script/DeployPool.s.sol` provides.

The first run is the result; the second is a re-entrancy limitation of a spike
script.

## Exit criteria after this finding

- [x] Contracts compile and deploy on Konstellation
- [x] Verifiers execute within the block gas limit
- [x] Deposit → withdraw end to end with a real proof
- [x] Native KASH, no wrapping
- [x] **Relayer path works — recipient pays no gas**
- [ ] SDK scanning: balance from chain data + keys alone
- [ ] Frozen address refused at the perimeter (now unblocked — `x/compliance` is on `main`)

Five of seven. **P0-A's stated gates are met**; what remains are the two items
that were always scheduled after it.
