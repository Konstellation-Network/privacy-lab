# poc — P0-A spike artifacts

Two files, both ours. They run against `0xbow-io/privacy-pools-core` @ `c312dcd5`
(Apache-2.0), which is an **external dependency, never vendored** — clone it
yourself, don't copy it into the org.

| File | What it does |
|---|---|
| `script/DeployPool.s.sol` | Stands up verifiers, the UUPS `Entrypoint` proxy, a native pool, and registers it. Used for the live-node run in [finding 007](../reports/007-deposit-works.md). |
| `test/KonstellationWithdraw.t.sol` | Full deposit → withdraw with a **real Groth16 proof**. [Finding 010](../reports/010-withdrawal-works.md). |

## Reproducing

```bash
# 1. local Konstellation node (see reports/003)
cd konstellation && go install ./cmd/konstellationd
export PATH="$(go env GOPATH)/bin:$PATH"
./local_node.sh -y

# 2. dependency, at the pin
git clone --depth 1 https://github.com/0xbow-io/privacy-pools-core.git
cd privacy-pools-core && git checkout c312dcd58f6ad085204be61923c49f8065e4e9ae
yarn install

# 3. copy our two files in
mkdir -p packages/contracts/test/konstellation
cp <privacy-lab>/poc/test/KonstellationWithdraw.t.sol packages/contracts/test/konstellation/
cp <privacy-lab>/poc/script/DeployPool.s.sol         packages/contracts/script/

# 4. run. The -R override works around an upstream remappings bug (reports/005).
cd packages/contracts
FOUNDRY_PROFILE=test forge test --match-contract KonstellationWithdraw --ffi -vv \
  -R "lean-imt/=$PWD/../../node_modules/@zk-kit/lean-imt.sol/"

# 5. deploy to the live node
export PRIVATE_KEY=0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305  # dev0, public
forge script script/DeployPool.s.sol:DeployPool --rpc-url http://127.0.0.1:8545 \
  --broadcast --skip-simulation -R "lean-imt/=$PWD/../../node_modules/@zk-kit/lean-imt.sol/"
```

The test imports upstream's `IntegrationUtils` for its Poseidon and proof helpers,
so it must sit under `packages/contracts/test/`. It does **not** inherit upstream's
`IntegrationBase`, which forks mainnet and needs DAI and CreateX — see
[finding 009](../reports/009-createx-missing.md).

## Two traps worth knowing

**`++nonce`.** `PrivacyPool.deposit` computes the label with a *pre*-increment, so
the first deposit's label uses nonce **1**, not the 0 you read beforehand. Getting
this wrong produces a valid proof against a tree the pool has never seen, and the
only symptom is `UnknownStateRoot()`.

**`ASP_POSTMAN` = owner here.** Both roles are dev0 in these files. On anything
real they must be separate keys — [finding 008](../reports/008-asp-changes-the-d14-picture.md).
