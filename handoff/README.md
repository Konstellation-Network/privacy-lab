# Handoff — commits that could not be pushed

**Date:** 2026-09-28
**Reason:** the account doing this work (`Psalmuel01`) has `push=false` on
`.github`, `contracts` and `konstellation`. Those repos are private with
`allow_forking=false`, so a fork-and-PR is also unavailable. `privacy-lab` was
pushed normally.

Nothing here is lost — every commit exists locally on each repo's `main`, and the
patches below reproduce them anywhere.

## Fixing it properly

Someone with admin on `Konstellation-Network` grants `Psalmuel01` **write** on
`.github`, `contracts` and `konstellation`. After that:

```bash
cd <repo> && git push origin main      # or branch first, if you prefer PRs
```

## Applying the patches instead

From a checkout with write access:

```bash
cd <repo>
git checkout -b createx-preinstall origin/main
git am /path/to/handoff/<repo>-patches/*.patch
git push -u origin createx-preinstall
gh pr create --fill
```

`git am` preserves the original messages, authorship and co-author trailers.

---

## What is in each

### `contracts` — 1 commit

**Pin CreateX for the genesis preinstall set.**

Adds `preinstalls/CreateX.json`. CreateX is a CREATE/CREATE2/CREATE3 factory that
sits at the same address on most EVM chains and that deployment tooling assumes
exists. It is in neither cosmos/evm's `DefaultPreinstalls` nor ours.

Verification done, per `ENGINEERING.md §6.3`:

- Bytecode from **three independent mainnet RPCs**, all 11,838 identical bytes
- keccak codeHash matches **mainnet's own `eth_getProof` state trie**, not just
  our recomputation
- Stateless, no constructor deployments, no companion contract — the §6.3
  constructor hazard that nearly broke PR #4 does not apply
- It *does* embed its own address, so it only functions at
  `0xba5Ed0…ba5Ed`; a preinstall guarantees that
- `forge test GenesisBytecode` passes; `VerifyPreinstalls` against live mainnet
  reports **all 8 OK**

### `konstellation` — 1 commit

**Preinstall CreateX at its canonical address.**

Adds the byte-identical copy under `app/preinstalls/` (the source-of-truth rule
in `STATUS.md §3`), registers it in `Files`, and pins its address and codeHash in
`preinstalls_test.go`. Genesis now carries **11** preinstalls.

Verified on a fresh chain: `eth_getCode` returns 11,838 bytes matching mainnet,
and `deployCreate()` through it deployed a contract (status 1, 57,743 gas).

No `Dependencies` entry is needed — unlike the ERC-4337 EntryPoints, CreateX has
no companion.

### `.github` — 5 commits

Documentation only; no code.

| Commit | What |
|---|---|
| `5139dfb` | **D14** — privacy/compliance enforcement boundary: gate the perimeter, accept the interior is unenforceable by the ante decorator |
| `9d5195a` | Org map: `privacy-lab` added (`§5`, `CLAUDE.md`) |
| `edc323f` | **D14 amended** — a pool can enforce inside the proof via an association set; its publisher is a second high-value key, now in `§10`'s risk list |
| `6714a4a` | `§10.1` — perimeter behaviour is now **observed**, not analysed |
| `5846692` | **D15** — privacy is an optional feature, integrate not rebuild; CreateX in the preinstall set |

---

## Two things needing a human decision

**1. CreateX is AGPL-3.0-only**, unlike every other pin in the set. It ships as
deployed bytecode at a canonical address rather than source we modify or link —
the same posture every chain preinstalling it takes — but it is a different
licence class and deserves an explicit decision before mainnet genesis rather
than being waved through. Flagged in the JSON and in both commit messages.

**2. The preinstall window closes at genesis.** `networks/testnet-1/genesis.json`
has not been cut. Preinstalls are genesis-only, and CreateX's deployment method
means it cannot simply be redeployed to the same address afterwards — that would
need a coordinated chain upgrade. Cheap now, expensive later.

## Provenance

CreateX was found missing because Privacy Pools' integration suite would not
start against a local Konstellation node
(`privacy-lab/reports/009-createx-missing.md`). The gap is not privacy-specific:
any project arriving with CreateX in its toolchain hits the same wall.
