# Finding 008 — The ASP is a second enforcement layer, and it revises 004

**Date:** 2026-09-17
**Status:** executed against a live node. **Supersedes part of
[004](004-d14-perimeter-analysis.md).**

## What 004 got wrong

Finding 004 concluded that the withdrawal side of D14's perimeter is unenforceable,
because the recipient hides inside `bytes data` where the ante decorator cannot
read it. **That part is still true.** What 004 missed is that Privacy Pools does
not rely on the recipient being checked at all.

It enforces at the *source* instead, inside the proof.

## The Association Set Provider

The withdraw circuit takes an `ASPRoot` as a public signal. Every withdrawal proves
membership of the depositor's label in an approved set, published on chain:

```solidity
function updateRoot(uint256 _root, string memory _ipfsCID)
  external onlyRole(_ASP_POSTMAN) returns (uint256 _index)
```

Verified working on our node:

```
updateRoot(root, "QmTest...")  →  status 1, 166,785 gas, block 3319
latestRoot()                   →  1871805627928815330200991885724902890157746203199041811965006804186241082629
```

The root is stored with an IPFS CID and a timestamp, so the set backing each root is
publicly auditable. A withdrawal whose deposit is not in the current set **cannot
produce a valid proof** — it fails in the circuit, not in a contract check that
someone could route around.

## Why this is stronger than what D14 assumed

D14 was written against an ante decorator that reads message structure. The ASP is a
different mechanism with different reach:

| | Ante decorator (D6) | ASP (Privacy Pools) |
|---|---|---|
| Enforces on | Addresses in the tx | Membership proven in the circuit |
| Deposit | Yes — `msg.sender` is the signer | Indirectly: excluded from later sets |
| Withdrawal | **No** — recipient is in opaque calldata | **Yes** — no valid proof without membership |
| Bypass | — | None; the proof simply fails |
| Who holds it | Foundation multisig (D6) | `ASP_POSTMAN` role |

So the withdrawal gap 004 identified is real *for the ante decorator* and closed
*by the protocol* — provided the ASP set is curated.

## The leak D14 accepts is smaller than we thought

D14 accepts: shield before a freeze, unshield to a fresh address after.

With an ASP, that leak narrows. If the authority publishes a new root excluding the
frozen depositor's label, **the frozen funds can no longer be withdrawn at all** —
the proof fails regardless of recipient. The accepted leak shrinks to the window
between the freeze and the next root publication.

This is materially better than 004 concluded, and better than D14's text implies.

## What it costs

Nothing is free, and this deserves saying plainly rather than being sold.

**A second privileged key.** `ASP_POSTMAN` decides who can exit the pool. On our
deployment it is the same key as the owner. On anything real it must not be, and it
belongs alongside the D6 freeze authority in `ENGINEERING.md §10`'s risk list — it
has the same "highest-value key" character and the same legal-obligation exposure.

**Curation is an ongoing staffed function**, not a switch. Someone maintains the set
and publishes roots. An unmaintained ASP either freezes everyone out (stale root) or
approves everyone (permissive root).

**It weakens privacy against the ASP operator**, who necessarily knows which
deposits are approved. That is a real disclosure surface the threat model §3 should
rank — it is a party with more visibility than a public observer.

**Availability risk.** If root publication stops, withdrawals stop. That is a
liveness dependency on an off-chain actor, which the threat model does not currently
model.

## Recommended follow-ups

1. **Revise D14's text** in `ENGINEERING.md §11`/§10.1 to describe both layers. The
   current wording says the interior is unenforceable, which is true of the ante
   decorator and misleading about the system as a whole.
2. **Add `ASP_POSTMAN` to the §10 risk list** beside the freeze authority.
3. **Add the ASP operator to the threat model §3 adversary table** — between RPC
   provider and validator, by visibility.
4. **Decide who holds it** if a pool ever ships. That is a supervisor question
   adjacent to threat-model Q1, not an engineering one.

## Correction discipline

004's contract reading was accurate; its conclusion was incomplete because it
stopped at the contracts and did not read the circuit's public signals. Recorded
here rather than edited in place so the reasoning stays auditable.
