# privacy-lab

Research workspace for Konstellation's privacy track. **Nothing here is consensus
code and nothing here ships to a network.**

Proposed in the Privacy Architecture & Implementation Strategy (2026-09-15) §12,
which asks that experiments stay outside the consensus-critical chain path until a
design is chosen, so research code cannot quietly become production architecture.

```
poc/             P0-A: compatibility spike against a local Konstellation node
reports/         measurements, compatibility findings, decisions
```

## What this repo may not do

From the strategy's Appendix A (agent guardrails), and binding here:

- Never create or wire `x/privacy` into the chain during the feasibility phase.
- Never modify consensus, ante handlers, bank accounting, staking, IBC or genesis
  parameters for a proof of concept.
- Never fork `cosmos/evm`, `cosmos-sdk`, `cometbft` or `ibc-go` (`ENGINEERING.md §2.1`).
- Never vendor a third-party privacy protocol's contracts into the org. They stay
  external test dependencies, pinned by commit.
- Never call compatibility "proven" until deposit → private transfer → withdraw
  succeeds end to end on the exact pinned Konstellation local chain.
- Never deploy a dependency whose license does not permit it (finding 001).

`konstellation` remains the only repo that produces a binary.

## Scope of the current spike (P0-A)

**Subject: `0xbow-io/privacy-pools-core` (Apache-2.0), pinned at `c312dcd5`.**
RAILGUN was the strategy's first feasibility path, but its contracts are UNLICENSED
([finding 001](reports/001-railgun-licensing.md)) and outreach went unanswered, so
the spike was redirected ([finding 002](reports/002-alternative-privacy-pools.md)).
The strategy §4 ranks ZK shielded UTXO as the direction; RAILGUN was one route to it.

**Native KASH only.** Native KASH wrapped through `contracts/src/WKASH.sol`, shielded,
transferred privately, unshielded. Arbitrary ERC-20s are out of scope for V1
(threat model Q4).

Requirements and exit criteria: *Konstellation Privacy: Threat Model &
Requirements (V1)*, §8. The short version — a demo where the recipient pays their
own gas proves nothing about privacy, so the broadcaster/relayer path is a gate,
not a stretch goal.

## Recording rules

Every experiment records versions, commit SHAs, contract addresses, gas figures,
proof times, RPC requirements and failures. A spike that cannot be re-run from
what it wrote down did not happen.
