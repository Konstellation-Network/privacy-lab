# Finding 002 — Privacy Pools (0xbow) is a licensed alternative that unblocks P0-A

**Date:** 2026-09-17
**Status:** proposal. Recommends redirecting the P0-A spike.
**Follows:** [001](001-railgun-licensing.md) — RAILGUN's contracts are UNLICENSED, and
outreach has not been answered.

## The constraint

We cannot wait on RAILGUN. The timeline does not allow an open-ended block on a
third party replying, and deploying UNLICENSED contracts to a network holding real
user funds is not a risk we can carry (`ENGINEERING.md §1`).

The privacy strategy §4 already ranks **"ZK shielded UTXO"** as the primary
direction and RAILGUN as merely the *first feasibility path*. Swapping the path is
consistent with the strategy, not a departure from it.

## The candidate

`0xbow-io/privacy-pools-core`, pinned at `c312dcd58f6ad085204be61923c49f8065e4e9ae`
(2026-08-31).

| Property | Value | Why it matters here |
|---|---|---|
| **License** | **Apache-2.0** | Resolves finding 001 outright |
| Build system | **Foundry** | Matches `contracts/`; no Hardhat toolchain to add |
| solc | **0.8.28**, `via_ir`, 10k runs | Same version as our `WKASH.sol` |
| Audits | **4 published** (Oxorio ×3, Auditware) | D9 scope shrinks; not a fresh unaudited surface |
| Relayer | **shipped in-repo** (`packages/relayer`) | The gas-linkage gate, solved upstream |
| Circuits | shipped (`packages/circuits`, audited) | No trusted-setup work invented by us |
| SDK | shipped (`packages/sdk`, TypeScript) | Wallet-side scanning without writing it |
| Native assets | supported alongside ERC-20 | May remove the WKASH wrapping step entirely |
| Maintenance | pushed 2026-09-14 | Active |

Contracts: `PrivacyPool.sol`, `Entrypoint.sol`, `State.sol`, `BatchRelayer.sol`.

## Why this fits Konstellation better than RAILGUN did

Three things beyond the license.

**The relayer is in the box.** The threat model §8 makes the broadcaster path a
*gate*, not a stretch goal — a demo where the recipient pays their own gas proves
nothing, because the funding transaction relinks the fresh address. RAILGUN's
broadcaster network is separate infrastructure. Here it is a package in the same
repo with a Dockerfile.

**Foundry, not Hardhat.** `contracts/` is already a Foundry project. One toolchain,
and `forge` is already installed.

**The compliance model is closer to ours.** Privacy Pools is built around proving
membership in an *approved set* — an association-set model — rather than being
compliance-neutral. That is adjacent to D6's allow/block lists in a way RAILGUN is
not. It does **not** automatically satisfy D14, and the interaction needs its own
analysis before anything ships; but the shapes are compatible rather than opposed.

## What does not change

- **D14 still holds.** Enforcement gates the shield/unshield perimeter; the interior
  is unreachable by an ante decorator regardless of which protocol is inside.
- **The threat model's exit criteria are protocol-agnostic.** §8's checklist —
  gas per operation, proof time, RPC call pattern, frozen address refused at the
  perimeter, metadata visible from raw RPC — applies unchanged.
- **The guardrails hold.** External dependency, pinned by commit, never vendored,
  no `x/privacy`, no consensus changes.
- **Scope stays V1/Q4.** Native KASH only. If native support removes the WKASH
  wrapping step, that simplifies the flow; it does not widen the scope.

## What must still be proven

Apache-2.0 removes the legal blocker. It does not make the thing work here.

1. Contracts compile and deploy against Konstellation's EVM (Prague, chain 56670).
2. Circuits' verifier contracts execute within the block gas limit — still unset,
   and still closing when `networks/testnet-1/genesis.json` is cut.
3. The relayer can be configured for a Konstellation RPC.
4. The SDK's scanning works against our JSON-RPC.
5. A frozen address is refused at deposit and at withdrawal (D14).

Same bar as before. Only the subject changed.

## Recommendation

**Redirect P0-A to Privacy Pools; keep the RAILGUN question open but off the
critical path.** If a license grant arrives later, comparing two working spikes is a
better position than having waited for one.
