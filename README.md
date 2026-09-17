# privacy-lab

Research workspace for Konstellation's privacy track. **Nothing here is consensus
code and nothing here ships to a network.**

Proposed in the Privacy Architecture & Implementation Strategy (2026-09-15) §12,
which asks that experiments stay outside the consensus-critical chain path until a
design is chosen, so research code cannot quietly become production architecture.

```
railgun-poc/     P0-A: RAILGUN compatibility spike against a local Konstellation node
reports/         measurements, compatibility findings, decisions
```

## What this repo may not do

From the strategy's Appendix A (agent guardrails), and binding here:

- Never create or wire `x/privacy` into the chain during the feasibility phase.
- Never modify consensus, ante handlers, bank accounting, staking, IBC or genesis
  parameters for a proof of concept.
- Never fork `cosmos/evm`, `cosmos-sdk`, `cometbft` or `ibc-go` (`ENGINEERING.md §2.1`).
- Never vendor RAILGUN's contracts into the org. They are an external test
  dependency, pinned by commit.
- Never call RAILGUN compatibility "proven" until shield → private transfer →
  unshield succeeds end to end on the exact pinned Konstellation local chain.

`konstellation` remains the only repo that produces a binary.

## Scope of the current spike (P0-A)

**WKASH only.** Native KASH wrapped through `contracts/src/WKASH.sol`, shielded,
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
