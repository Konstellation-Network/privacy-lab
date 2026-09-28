# Integration plan — Privacy Pools on Konstellation

**Date:** 2026-09-28
**Authorised by:** D15 (`ENGINEERING.md §11`) — privacy is an optional feature;
integrate rather than rebuild.
**Status:** plan. Nothing below has been executed.

Written for whoever picks this up. Every step says which repo it touches and what
must be true before it starts.

## The one-line shape

Deploy an audited third-party pool to **testnet-1 first**, learn what curating it
actually costs, and ship to mainnet only when there are enough users for privacy
to mean anything.

## What is already done

| | Where |
|---|---|
| Feasibility proven end to end | [000](000-P0A-SUMMARY.md) |
| Deploy script | `poc/script/DeployPool.s.sol` |
| Withdrawal test with real proofs | `poc/test/KonstellationWithdraw.t.sol` |
| Relayer harness | `poc/relayer/relayed-withdraw.mjs` |
| CreateX preinstalled (its test suite needs it) | `contracts`, `konstellation` |

## Blocked until testnet-1 exists

`networks/testnet-1/genesis.json` has not been cut. Everything below waits on it —
there is no network to deploy to.

---

## Phase A — testnet-1 deployment

**Blocked on:** testnet-1 live.

### A1. Contracts → `contracts`

Privacy Pools is an **external dependency, pinned by commit, never vendored**
(Appendix A). What lands in `contracts` is our deployment script and pin record,
not their source.

- `contracts/script/DeployPrivacyPool.s.sol` — hardened from `poc/`
- `contracts/privacy-pools.pin` — commit `c312dcd5`, Apache-2.0, audit links
- **Separate the two roles.** `poc/` passes the same address as owner *and*
  `ASP_POSTMAN`; on any real network they must be different keys ([008](008-asp-changes-the-d14-picture.md)).
- Record deployed addresses in `networks/testnet-1/`.

### A2. Relayer → `infra`

The relayer is production infrastructure, not a script. Per `ENGINEERING.md §9.1`
stateless services belong on the app tier, not validators.

- Docker service, its own key, funded and monitored
- Alert on: signer balance, RPC reachability, request failures
- `allowed_domains` must be set explicitly — the upstream default crashes on
  startup ([013](013-relayer-runs.md))
- **It is a liveness dependency**: no relayer, no private withdrawals

### A3. Association set → `infra` + a decision

**This is the part that is not engineering.** Someone must curate the set and
publish roots. Needs: the key holder named, a publication cadence, a documented
inclusion policy, and IPFS pinning for each root.

Until that is answered, A3 cannot start — and A1/A2 are not useful without it.

### A4. Docs → `docs`

Must say plainly, because users will otherwise assume otherwise:

- **Using the pool is public.** Deposits name the depositor on chain.
- **Your anonymity set is whoever shares your ASP root**, not "everyone".
- An address frozen *after* depositing can still be paid out ([015](015-d14-perimeter-observed.md)).
- Lose your keys and the funds are unrecoverable by anyone.

---

## Phase B — soak on testnet-1

**Minimum one month.** The point is the operational load, not the code.

Measure: curation effort in hours, relayer uptime and cost, proof time on ordinary
laptops (**never benchmarked** — [000](000-P0A-SUMMARY.md)), wallet scan time as
history grows ([017](017-scanning-and-rpc-exposure.md)), and the real anonymity
set achieved.

Exit: a month clean, and someone willing to own curation on mainnet.

---

## Phase C — mainnet, conditional

**Gates, all required:**

1. Phase B clean for a month
2. **Enough baseline activity for a real anonymity set** — the one condition with no engineering workaround
3. Association-set key with a named holder and a published policy
4. D9 audit covers the integration, not just the chain
5. Legal review of the ASP-operator role, alongside D6's
6. Value cap on the pool, mirroring D8's posture

Gate 2 is the one to hold firm on. A pool in a quiet chain is privacy in form and
not in fact, and the users who suffer are the earliest ones.

---

## Decisions still open

| # | Question | Blocks |
|---|---|---|
| 1 | **Who holds the association-set key?** | A3, and therefore all of Phase A |
| 2 | Do we run one relayer or several? | A2 — one is a metadata and liveness chokepoint |
| 3 | Does Cosmos's native ZK-UTXO module (H1 2026) supersede this? | Phase C, possibly earlier |
| 4 | CreateX is AGPL-3.0 — accepted for mainnet? | genesis |

## Threat-model edits owed

Small, and they should not wait:

- **Reword P2** — it describes a "shielded transfer" this protocol does not have ([016](016-how-it-works-and-a-correction.md))
- **Add §3 rows** for the ASP operator and the relayer; both learn things a public observer does not
- **Add a §4 row**: RPC-provider exposure is mitigated by the user's own node, not in-protocol ([017](017-scanning-and-rpc-exposure.md))

## What would make me stop

Recorded so it is not rationalised away later:

- Cosmos ships a native module that covers this → stop and reassess (strategy §13 "upstream duplication")
- Nobody will own curation → stop; an uncurated set is worse than no pool
- Proof time on consumer hardware is unusable → stop; this spike never measured it
