# Finding 003 — Local Konstellation environment, measured

**Date:** 2026-09-17
**Status:** baseline. Facts measured against a running node, not assumed.
**Node:** `konstellationd` built from `konstellation` `main` @ `ace9616`, Go 1.26.8, arm64.

## The environment

| Property | Value | How |
|---|---|---|
| EIP-155 chain id | **56670** (`0xdd5e`) | `eth_chainId` |
| Cosmos chain-id | `konstellation-local-1` | `local_node.sh` default |
| **Block gas limit** | **10,000,000** | `eth_getBlockByNumber` → `gasLimit` |
| Base fee at idle | ~1.88 Mwei (1,880,955 wei) | same call, `baseFeePerGas` |
| `eth_gasPrice` | 0x2049ea (2,116,074 wei) | `eth_gasPrice` |
| dev0 balance | 100,000 KASH | `eth_getBalance` |
| dev0 address | `0xC6Fe5D33615a1C52c08018c47E8Bc53646A0E101` | `local_node.sh` (key is public) |
| JSON-RPC | `http://127.0.0.1:8545` | — |

Preinstalls verified live: `Create2Deployer` at `0x13b0D85C…` has 2,731 bytes of code;
the `werc20` native precompile at `0xD4949664…` responds with bytecode.

The compliance precompile at `0x…0900` returns `0x` — expected. PR #10 is not merged
into `main`, so this binary does not carry `x/compliance`. Any D14 perimeter test
(threat model §8) needs a build from the `x-compliance` branch instead.

## The block gas limit, now a number

The threat model §8 flagged this as an open risk with a deadline: the limit is unset
in the repository and lands in `networks/testnet-1/genesis.json`, which has not been
cut. **On a local dev chain it is 10,000,000.**

That figure comes from the SDK/CometBFT default path rather than a Konstellation
decision, so testnet-1 could be set differently — but 10M is what the code produces
today, and it is the number a spike must fit inside unless someone chooses otherwise.

**Why it matters for this spike.** A Groth16 verification runs roughly 200k–300k gas.
A deposit or withdrawal that wraps one is plausibly 400k–600k once state writes,
Merkle updates and transfer logic are counted. Against a 10M block that is comfortable
for a single operation — perhaps 15–25 of them per block, before competing with
ordinary traffic.

So the limit is very unlikely to block feasibility. What it constrains is *throughput
under load*, which is a different question and not one P0-A needs to answer.

**The deadline still stands.** Measured gas per operation should reach whoever writes
`networks/testnet-1/genesis.json`, because after genesis the limit moves only by
governance proposal. Recording 10M here means that conversation starts from evidence.

## Reproducing

```bash
cd konstellation && make build        # or: go install ./cmd/konstellationd
export PATH="$HOME/go/bin:$PATH"      # local_node.sh calls the binary by name
./local_node.sh -y                    # -y overwrites previous chain data
```

`local_node.sh` runs `go install`, which lands the binary in `$(go env GOPATH)/bin`.
That directory is not on PATH by default here, and the script fails with
`konstellationd: command not found` if it is missing. `make build` writes to
`build/` instead, which is not where the script looks.
