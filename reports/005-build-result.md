# Finding 005 — Privacy Pools compiles clean, with one upstream packaging bug

**Date:** 2026-09-17
**Status:** build verified locally. Deployment not yet attempted.
**Subject:** `0xbow-io/privacy-pools-core` @ `c312dcd5`, solc 0.8.28, Foundry 1.5.1-stable.

## Result: it builds

`forge build` produces artifacts for every contract the spike needs.

| Contract | Deployed bytecode | vs EIP-170 (24,576) |
|---|---|---|
| `Entrypoint` | 13,490 bytes | 55% |
| `PrivacyPoolSimple` | 7,378 bytes | 30% |
| `BatchRelayer` | 3,247 bytes | 13% |
| `WithdrawalVerifier` | **1,947 bytes** | 8% |
| `CommitmentVerifier` | **1,582 bytes** | 6% |

The two Groth16 verifiers are the smallest contracts in the set — under 2 KB each.
That is characteristic of Groth16: verification is a fixed pairing check, so the
verifier is small and its gas cost is near-constant regardless of circuit size.

Nothing is near the contract-size limit. Combined with the 10,000,000 block gas
limit measured in [003](003-environment-baseline.md), there is no size or gas
obstacle visible at build time.

## The packaging bug

`packages/contracts/remappings.txt` line 3 ships without a trailing slash:

```
lean-imt/=../../node_modules/@zk-kit/lean-imt.sol
```

so `import 'lean-imt/InternalLeanIMT.sol'` resolves to
`.../lean-imt.solInternalLeanIMT.sol` — the package directory and the filename
concatenated. Every file importing it fails to parse.

Affects `test/` and `script/` only; `src/` does not import it. But solc parses the
whole project before compiling, so `--skip test --skip script` does not avoid it:
`--skip` filters compilation, not parsing.

**Workaround:** pass the remapping explicitly.

```bash
forge build -R "lean-imt/=$PWD/../../node_modules/@zk-kit/lean-imt.sol/"
```

Editing `remappings.txt` to add the slash makes `forge remappings` report the
corrected path, but the build still failed for us — `forge clean` did not help
either. The `-R` override is what worked. Worth re-testing on a newer Foundry
before reporting upstream, since this smells like a resolution-order quirk rather
than a pure content issue.

**This is an upstream bug, not a Konstellation incompatibility.** It would break on
any chain. Recording it because it costs an hour if you meet it cold, and because
an upstream project whose test suite does not build out of the box is a small
signal about release hygiene — worth weighing alongside the four published audits,
not against them.

## What this does and does not prove

**Does:** the contracts compile at the pinned solc, produce deployable artifacts,
and fit comfortably inside EIP-170.

**Does not:** that they deploy to Konstellation, that the verifiers execute
correctly under our EVM, or anything about gas at runtime. Compilation is
chain-independent — this result would be identical on any EVM chain, and says
nothing yet about Prague, chain 56670, or `x/compliance`.

Next: deploy to the local node and measure real gas.
