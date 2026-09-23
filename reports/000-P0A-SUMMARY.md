# P0-A — compatibility report

**Date:** 2026-09-23
**Question P0-A asks:** *does a ZK shielded pool function correctly and acceptably
on Cosmos EVM as Konstellation configures it?*
**Answer: yes, demonstrated end to end.** That is a feasibility result, not a
recommendation to ship.

| | |
|---|---|
| Subject | `0xbow-io/privacy-pools-core` @ `c312dcd5`, Apache-2.0 |
| Chain | `konstellationd` from `main` @ `a9051f6`, chain 56670, cosmos/evm v0.7.3 |
| Findings | [001](001-railgun-licensing.md)–[017](017-scanning-and-rpc-exposure.md) |
| Artifacts | `poc/` — deploy script, withdrawal test, relayer harness, scan test |

## Exit criteria (threat model §8)

| # | Criterion | Result |
|---|---|---|
| 1 | Contracts compile and deploy on Konstellation's EVM | ✅ [005](005-build-result.md), [006](006-groth16-runs-on-konstellation.md) |
| 2 | Verifiers execute within the block gas limit | ✅ 26k verify; 10M limit ([003](003-environment-baseline.md)) |
| 3 | Deposit → withdraw, real Groth16 proof | ✅ [010](010-withdrawal-works.md) |
| 4 | Native KASH, no wrapping | ✅ [007](007-deposit-works.md) — WKASH drops out |
| 5 | **Relayer: recipient pays no gas** | ✅ [014](014-gas-linkage-gate-passes.md) |
| 6 | Wallet scanning from chain data + keys | ✅ fetch layer ([017](017-scanning-and-rpc-exposure.md)); full mnemonic round-trip untested |
| 7 | Frozen address refused at the perimeter | ⚠️ **partial** — [015](015-d14-perimeter-observed.md) |

### Measured

| Operation | Gas | Share of a 10M block |
|---|---|---|
| Deposit | 265,138 | 2.7 % |
| Withdraw (with proof) | 465,153 | 4.7 % |
| ASP `updateRoot` | 166,785 | 1.7 % |
| Verifier deploy (one-off) | 474,090 | 4.7 % |

Contract sizes are 6–55 % of EIP-170. **Gas and size are not constraints.**

## The headline result

`ecPairing` (0x08) works, so Groth16 verification runs. That was the single
largest unknown: the strategy's §13 ranks "assuming EVM compatibility implies
compatibility" as the top risk, and for a ZK system it concentrates in the
`alt_bn128` precompiles. They behave per spec.

The relayer gate then passed for real: a recipient received 3.96 KASH **at nonce
0** — value reached an address that has never sent a transaction, so no funding
transaction links it to anyone.

## What the spike found that we did not go looking for

1. **[011](011-pr10-breaks-evm-txs.md) — PR #10 broke every EVM transaction.** A
   `ValidateBasic` guard rejected any tx without Cosmos signatures, which is every
   EVM tx. Reproduced, root-caused, reported; fixed in `f63c1b7` with a regression
   test, verified live in [012](012-pr10-fix-verified.md). Found only because a
   privacy spike happened to need a compliance-enabled chain.
2. **[009](009-createx-missing.md) — CreateX is absent from our preinstalls.** A
   deterministic-deployment singleton most EVM tooling assumes. Preinstalls are
   genesis-only and `networks/testnet-1/genesis.json` is not yet cut, so this is
   cheap now and a governance action later.
3. **[015](015-d14-perimeter-observed.md) — a pool can pay a frozen address.** The
   association set, not the ante decorator, is the control.
4. **`eth_getLogs` is capped at 10,000 blocks** ([017](017-scanning-and-rpc-exposure.md)),
   so wallets paginate — ~2,100 requests per year of history.

## What is true, and what is not

**True:** the protocol works here. EVM semantics, EC precompiles, Poseidon, Lean
IMT, UUPS proxies, native-asset handling, real proofs, a working relayer, and
pool-wide scanning that does not leak which note a user cares about.

**Not true, and worth stating because earlier findings said otherwise
([016](016-how-it-works-and-a-correction.md)):** this is **not** a
peer-to-peer shielded transfer system. `PrivacyPool` has no internal transfer
function. It is *withdraw-to-anyone*; privacy comes from deposit/withdrawal
unlinkability. **Threat model P2 needs rewording** before it is used as an
acceptance criterion.

**Not established:**

- That a pool *should* ship. Threat-model **Q1** (privacy optional or defining)
  and **Q2** (genesis or later) are supervisor decisions, untouched by this work.
  The §4 recommendation stands: a pool launched into thin volume has an anonymity
  set of single digits, and those users get a guarantee that is sound in form and
  absent in practice.
- Any security property of Privacy Pools itself. Four audits exist; this spike is
  not a fifth.
- Proof-generation time on consumer hardware. The prover ran under `--ffi` on a
  dev machine and was not benchmarked.
- Behaviour under load, with many depositors, or across a restart.

## Costs a decision must price in

- **A second high-value key.** The ASP publisher decides who exits. It must not be
  the freeze-authority key, and who holds it is unresolved (`ENGINEERING.md §10`).
- **Curation is a staffed function.** A stale root freezes everyone out; a
  permissive one approves everyone.
- **Two new trusted parties for metadata.** The ASP operator knows which deposits
  are approved and bounds the real anonymity set; the relayer learns the recipient.
  Neither is in the threat model's §3 table yet — **both should be added.**
- **A liveness dependency.** No root publication, no withdrawals.
- **Uniswap.** Inert for native KASH, but an ERC-20 pool would need a Uniswap v3
  deployment or a patched quote provider ([013](013-relayer-runs.md)).

## Recommended next steps

1. **Decide Q1 and Q2** before any further engineering. Everything downstream
   depends on them, and neither is an engineering call.
2. **Reword threat-model P2**, and add ASP-operator and relayer rows to §3.
3. **Evaluate CreateX** for the genesis preinstall set — independent of privacy,
   with a closing window.
4. If privacy proceeds: **P1 threat-model freeze → P2 hardened deployment**, per
   the strategy's phasing. Not before Q1/Q2.

Per the strategy's Appendix A: a successful spike proves architectural
feasibility, not production readiness. This proves feasibility.
