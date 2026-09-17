# Finding 009 — CreateX is missing from Konstellation genesis

**Date:** 2026-09-17
**Status:** executed. **Actionable against `contracts`/`konstellation` before testnet-1 genesis.**

## What happened

Privacy Pools' integration suite — the tests that exercise the full deposit →
withdraw cycle with real Groth16 proofs — fails in `setUp()`:

```
[FAIL: EvmError: Revert] setUp()
```

Cause: `test/integration/IntegrationBase.sol:55` expects the **CreateX** singleton.

```solidity
ICreateX internal constant _CREATEX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);
```

Confirmed absent on our chain:

| Contract | Address | On Konstellation |
|---|---|---|
| **CreateX** | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` | **0 bytes — absent** |
| Create2Deployer | `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2` | 2,731 bytes |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | 3,808 bytes |

## Why this matters beyond one test suite

CreateX is a deterministic-deployment factory deployed at the same address across
most EVM chains, the way Multicall3 and Permit2 are. Tooling assumes it. Our
genesis preinstalls (`ENGINEERING.md §6.3`) carry Create2Deployer, Multicall3,
Permit2, the ERC-4337 EntryPoints and their SenderCreators — but **not CreateX**.

The immediate consequence is narrow: one dependency's test suite will not run
unmodified. The broader one is that any project deploying to Konstellation with
CreateX in its toolchain hits the same wall, and finds it the hard way.

This is not a Privacy Pools problem. It is a gap in our preinstall set, and the
spike surfaced it by accident.

## The timing is the point

`networks/testnet-1/genesis.json` **has not been cut yet** (`networks` PR #1
deliberately left it out). Preinstalls are genesis-only: a contract at a canonical
address either exists from block zero or requires a coordinated upgrade later —
and CreateX's deployment is signature-based at a fixed address, so it cannot simply
be deployed post-genesis to the same address by anyone.

So this is cheap now and expensive after. Same shape as the EntryPoint /
SenderCreator issue that `konstellation` PR #4's review caught before merge.

## Recommendation

**Evaluate adding CreateX to the genesis preinstall set**, following the process
`ENGINEERING.md §6.3` already defines: pin the deployed bytecode in `contracts/
preinstalls/CreateX.json` with its `codeHash` guard, verify against two independent
mainnet RPCs with `VerifyPreinstalls.s.sol`, then wire it in `konstellation/app/
preinstalls`.

Worth checking during that evaluation:

- CreateX's constructor behaviour. A preinstall never runs its constructor
  (`ENGINEERING.md §6.3`), and the EntryPoint/SenderCreator episode showed what
  happens when a constructor-deployed companion is missed.
- Whether it self-references its own address in bytecode.
- Its licence, given finding 001 taught us not to assume.

**This is a recommendation, not a decision.** Adding a preinstall is permanent and
expands the audit surface (D9), so it belongs to whoever owns the genesis set — not
to this spike.

## Not a blocker for P0-A

We deployed the pool without CreateX by using ordinary `CREATE` in
`poc/script/DeployPool.s.sol`, and deposits work ([007](007-deposit-works.md)).
CreateX only buys deterministic addresses. What it blocks is running the upstream
integration suite unmodified, which is how we would most cheaply get a real
withdrawal proof.

## Unit tests, for contrast

Without CreateX in the way, the contracts' own unit suite is healthy:

```
109 passed; 1 failed (110 total)
```

The single failure is a fuzzer artifact, not a chain issue: `UnitPush` randomly
generated precompile address `0x0b` as a recipient, and Foundry refuses `vm.etch`
on precompiles. It would fail identically on Ethereum.
