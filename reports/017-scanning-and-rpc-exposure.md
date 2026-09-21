# Finding 017 — Wallet scanning, and what the RPC provider learns

**Date:** 2026-09-21
**Status:** threat model **P4** and the **§3 rank-1 adversary** answered.
**Node:** `konstellationd` from `main` @ `a9051f6`, chain 56670.

## The question

Threat model §3 ranks the **RPC provider first** among adversaries, because almost
every user reaches the chain through someone else's node. The specific fear: a
shielded wallet must find which notes are its own, and if it *asks* the RPC for
them, the provider learns which notes a user cares about — no cryptographic break
required.

§8 states it as P4: can a wallet reconstruct its balance from chain data plus its
keys alone?

## Result: the RPC provider learns interest in the pool, not in a user

Every call the wallet makes, instrumented:

```
eth_blockNumber   address=-                       user-filtered=no
eth_getLogs       address=0x1A38c7b3…5259         user-filtered=no
eth_getLogs       address=0x1A38c7b3…5259         user-filtered=no
eth_getLogs       address=0x1A38c7b3…5259         user-filtered=no
eth_getLogs       address=0x1A38c7b3…5259         user-filtered=no
```

Each `eth_getLogs` carries exactly **one topic — the event signature**:

```json
{"address":"0x1A38c7b3…5259","topics":["0xe3b53cd1…d6549"],"fromBlock":"0x0","toBlock":"latest"}
```

No indexed-argument filter, so no address, commitment or label narrows the query.
The wallet pulls **every** `Deposited` and `Withdrawn` event for the pool and
matches them locally against keys derived from its mnemonic.

**This is the right architecture.** The provider sees "this IP is interested in
the privacy pool" — unavoidable, since you must read the tree to spend — but not
*which* deposit is being tracked.

## The residual leak, stated honestly

It is not zero:

- **Interest in the pool is visible.** The provider knows this IP uses the pool.
  Combined with the fact that deposits are public
  ([007](007-deposit-works.md)), an IP that scans and also deposited from a known
  address is linkable by the provider.
- **Polling cadence is a fingerprint.** Regular scans are a behavioural signal.
- **No mitigation is built in.** Privacy from the RPC provider depends on the
  user's own network hygiene — their own node, or Tor. Nothing in the SDK
  addresses it, and nothing should pretend otherwise in user-facing docs.

So: **safe from a provider that wants to know which note is yours; not safe from
one that wants to know whether you use the pool at all.**

## A Konstellation-specific constraint, found by hitting it

`eth_getLogs` is capped at **10,000 blocks** per request:

```
error -32000: maximum [from, to] blocks distance: 10000
```

A wallet scanning from genesis must paginate. At 1.5 s blocks that is a chunk per
~4.2 hours of chain — **~2,100 requests per year of history**, per pool, per scan.

Not a blocker (the test paginated in 9,000-block chunks and completed), but it is
a real UX and cost factor that grows with chain age, and it is the kind of thing
that is invisible on a young chain and painful on an old one. Worth knowing before
anyone promises fast first-load in a wallet.

## P4: proven in the relevant sense

The wallet reconstructs from public event data plus locally derived keys, with no
server-side index and no user-identifying query. Commitments are visible to anyone;
matching them to an owner is local work.

**What is not yet proven:** a full `AccountService` round-trip recovering a real
balance from a mnemonic. This test verified the *fetch* layer and the *shape* of
what is asked — which is the part that bears on the §3 adversary — not the whole
derivation path. Calling P4 fully closed would overstate it.

## Recommendation for the threat model

Add an **RPC-provider mitigation row** to §4's leakage table:

| Leak | Visible to | Severity | Mitigation |
|---|---|---|---|
| Pool interest + polling cadence | RPC provider | Medium | user runs their own node, or Tor — **not** solved in-protocol |
