# Finding 001 — RAILGUN's contracts are UNLICENSED

**Date:** 2026-09-17
**Status:** blocker for P0-A as scoped. Needs a human decision before the spike proceeds.
**Found during:** Workstream B step 1 (pull RAILGUN contracts as an external dependency).

## What was found

`Railgun-Privacy/contract` — the repository holding the RAILGUN protocol contracts —
carries no license grant.

| Source | Value |
|---|---|
| GitHub license API | 404, no LICENSE file |
| `package.json` `license` field | `UNLICENSED` |
| SPDX header, `contracts/logic/RailgunSmartWallet.sol` | `// SPDX-License-Identifier: UNLICENSED` |
| SPDX header, `contracts/logic/RailgunLogic.sol` | `// SPDX-License-Identifier: UNLICENSED` |
| README | no licensing section |

Pinned at commit `36bcf5ed7cf94bfafb6e1a303e1832c769c16780` (2026-08-15), default
branch `main`.

Under default copyright, "no license" means no right to copy, modify or distribute —
not permission by silence. Deploying the contracts to a public network we operate is
distribution.

## What is *not* affected

The client-side stack is MIT and poses no problem:

| Repo | License | Last push |
|---|---|---|
| `Railgun-Community/engine` | MIT | 2026-07-14 |
| `Railgun-Community/wallet` | MIT | 2026-08-21 |
| `Railgun-Community/deployments` | none | 2026-08-15 |

So the wallet SDK and engine are usable. The on-chain half is the problem, and it is
the half that would hold user funds.

## Why this matters more for us than for most

`ENGINEERING.md §1`: Konstellation launches with real user funds from day one. A
contract holding those funds, whose copyright status is unresolved, is not a risk
that gets cheaper by deferring it — and it is exactly the kind of thing an audit
(D9, Informal Systems) would stop on.

## What it does not block

Local, non-public evaluation on a dev chain is a much weaker claim than deployment,
and the threat model's other exit criteria (gas cost, proof time, RPC call pattern)
can still be measured that way. This finding is about what we may *ship*, not about
what we may *learn*.

## Options

1. **Ask RAILGUN for a license grant.** Highest value, unknown latency. Contact
   before further engineering; a written grant resolves it permanently.
2. **Evaluate locally only, ship nothing.** Measure everything the threat model §8
   asks for on a local chain, treat the result as evidence for a build-vs-integrate
   decision, and do not deploy. Preserves the spike's learning value.
3. **Evaluate an alternative with a clear license.** Redirects the spike; the
   strategy's §4 already ranks "ZK shielded UTXO" above "RAILGUN specifically" —
   RAILGUN was the *first feasibility path*, not the requirement.
4. **Drop the integrate path, revisit `x/privacy` later.** The strategy's §6.3 makes
   this contingent on EVM-level privacy being unworkable; licensing is a different
   kind of unworkable than it anticipated, but the conclusion route is the same.

**Recommendation: 1 and 2 in parallel.** Ask for the grant, and meanwhile run the
local evaluation, which is useful under every outcome and commits us to nothing.

## A second issue, noted while here

`hardhat.config.ts` pins solc `0.8.17` and sets **no `evmVersion`**. Solc 0.8.17
defaults to the `london` target, so the contracts compile to London-era opcodes.
Konstellation runs **Prague** (`app/config/permissions.go` uses
`PrecompiledAddressesPrague`).

London bytecode on a Prague chain should execute — later hard forks add opcodes
rather than remove them — but "should" is what a spike exists to replace with
"observed". Worth an explicit test rather than an assumption, and worth recording
either way. It also means the contracts do not use PUSH0 (Shanghai) or any later
opcode, which makes them *more* portable, not less.
