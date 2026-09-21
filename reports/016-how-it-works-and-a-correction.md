# Finding 016 — How the flow actually works, and a correction

**Date:** 2026-09-21
**Status:** corrects wording used in [007](007-deposit-works.md),
[010](010-withdrawal-works.md), [014](014-gas-linkage-gate-passes.md) and the
threat model's **P2**.

## The correction first

Several findings describe the tested flow as **"deposit → private transfer →
withdraw"**. That is wrong, and it overstates what was demonstrated.

`PrivacyPool`'s entire external surface is:

```
deposit(...)      withdraw(...)      ragequit(...)      windDown()
```

**There is no internal transfer function.** Privacy Pools is a *withdraw-to-anyone*
design, not a peer-to-peer shielded-transfer design like RAILGUN's note model. You
cannot send value from one shielded holder to another inside the pool.

What was actually tested, and does work, is **deposit → withdraw to a different
address**. Privacy comes from unlinkability between the two, not from an internal
transfer.

**Threat model P2** reads *"a shielded transfer does not link sender to recipient
in chain data."* On this protocol that property is delivered by deposit/withdrawal
unlinkability instead. **P2 should be reworded** before it is used as an
acceptance criterion, or it will be read as promising something the protocol does
not offer.

## How the flow actually works

### Shield (deposit)

1. Pick two random secrets: `nullifier` and `secret`.
2. `precommitment = Poseidon(nullifier, secret)`.
3. Send value to `Entrypoint.deposit{value}(precommitment)`.
4. The pool derives `label = keccak(SCOPE, ++nonce) mod p`, computes
   `commitment = Poseidon(value, label, precommitment)`, and inserts that
   commitment as a leaf in a Lean Incremental Merkle Tree.

The chain now holds the funds and a hash. It does not record that the hash is
yours — only you know `nullifier` and `secret`.

**Public regardless:** depositor address, amount, timestamp. The `Deposited` event
indexes the depositor in the clear ([007](007-deposit-works.md)). *Using* the pool
is visible; what happens afterwards is not.

### Unshield (withdraw)

The Groth16 proof asserts, without revealing which leaf:

| Claim | Why it matters |
|---|---|
| I know `nullifier`/`secret` for some commitment in the tree | ownership |
| That commitment's value ≥ what I withdraw | no minting |
| Its `label` is in the published ASP root | compliance ([008](008-asp-changes-the-d14-picture.md)) |
| `nullifierHash` is derived from that nullifier | double-spend prevention |

Public signals: `newCommitmentHash`, `existingNullifierHash`, `withdrawnValue`,
`stateRoot`, `stateTreeDepth`, `ASPRoot`, `ASPTreeDepth`, `context`. **Not** the
leaf index, and not the depositor.

The pool verifies, marks the nullifier hash spent, inserts a new commitment for the
change, and pays out.

### Where the anonymity comes from

An observer sees a valid withdrawal and cannot tell which deposit it came from.
The anonymity set is every commitment in the tree — more precisely, every label in
the same ASP root, since the proof binds to a specific root
([008](008-asp-changes-the-d14-picture.md)).

That is why [004](004-d14-perimeter-analysis.md)'s finding matters so much: a
small ASP root is a small anonymity set, and the operator chooses its size.

### "Sending stealthily", concretely

Alice shields 10 KASH. Later, a withdrawal pays Bob 4 KASH. On chain:

- Alice's deposit is public.
- Bob's receipt is public.
- **Nothing connects them** — the proof does not reveal which leaf was spent.

With the relayer ([014](014-gas-linkage-gate-passes.md)), Bob never transacts, so
no funding transaction links him either. That is the whole privacy mechanism: not
a hidden transfer, but an unlinkable pair of public events.

Its strength is entirely a function of how many other deposits sit in the same ASP
root, and of timing — a 10 KASH deposit followed minutes later by a 4 KASH
withdrawal, in a pool with two users, is correlatable by inspection regardless of
the cryptography (threat model §4).

## Ragequit

`ragequit` deserves a note: it lets a depositor exit **their own** deposit without
an ASP proof, using the `CommitmentVerifier` instead. It is the escape hatch for
someone excluded from the association set — they get their money back, but only to
themselves, with no privacy. Worth knowing before anyone concludes that ASP
exclusion traps funds permanently. It does not; it removes the privacy, not the
ownership.

Not yet tested here.
