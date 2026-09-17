# Finding 011 — PR #10 breaks every EVM transaction

**Date:** 2026-09-17
**Status:** **reproduced and root-caused.** HIGH — would brick the EVM on any
network running this code.
**Found:** while setting up the D14 perimeter test (findings 004, 008).
**Branch:** `x-compliance` @ `ab66ba3`.

## Symptom

Every EVM transaction is rejected at submission:

```
$ cast send --value 1ether 0x...dEaD
Error: server returned an error response: error code -32000: no signatures supplied
```

Cosmos transactions are unaffected:

```
$ konstellationd tx bank send dev0 kons1jclt... 1000000000000000000esp
code: 0
```

Contract deploys fail the same way, so nothing can be deployed either.

## Root cause

`x/compliance/ante/ante.go`, `InvolvedAddresses()`, added in `f1234ea`:

```go
if v, ok := tx.(interface{ ValidateBasic() error }); ok {
    if err := v.ValidateBasic(); err != nil {
        return nil, err
    }
}
```

The SDK's `Tx.ValidateBasic` (`types/tx/types.go:90`) ends with:

```go
sigs := t.Signatures
if len(sigs) == 0 {
    return sdkerrors.ErrNoSignatures
}
```

**An EVM transaction has no Cosmos signatures.** Its authentication is the
Ethereum signature inside `MsgEthereumTx`, verified by cosmos/evm's own ante
chain. So `ValidateBasic` returns `ErrNoSignatures` for every valid EVM tx, and
`InvolvedAddresses` propagates that as an error.

`Check()` returns on any extraction error, and `Check()` is shared by **both**
the ante handler (`Wrap`) and the mempool pre-check (`compliancePreCheck`), so
the rejection happens at every entry point — `eth_sendRawTransaction`, ABCI
`CheckTx`, ABCI `InsertTx`, and `DeliverTx`.

## Proof

Removing only those five lines and rebuilding:

```
$ cast send --value 1ether 0x...dEaD
blockNumber  512
status       1 (success)
```

Nothing else changed. The worktree has been restored to `ab66ba3`.

## Why the tests did not catch it

`ante_test.go` builds transactions with `txBuilder` helpers and calls
`InvolvedAddresses` directly on them. Those fixtures either carry signatures or
are Cosmos-shaped. No test submits a *real* EVM transaction through a running
node with the module enabled — which is exactly the gap that
`TestInvolvedAddresses_MalformedDoesNotPanic` was added to cover, but from the
other direction: it checks malformed input produces an error rather than a panic,
and a valid EVM tx also produces an error.

## The irony worth noting

This was introduced by the hardening in `f1234ea`, responding to review round 1.
The comment above it says:

> Safe on an unvalidated tx: the SDK tx wrapper's FeePayer/FeeGranter panic on
> malformed AuthInfo, so the tx's own ValidateBasic runs first

The reasoning is sound — the mempool pre-check does run before `ValidateBasic`
elsewhere, and `FeePayer()` can panic. The mistake is using
`Tx.ValidateBasic` as the guard, because it asserts something untrue of EVM
transactions.

## Suggested fix

The panic guard is already there and sufficient:

```go
defer func() {
    if r := recover(); r != nil {
        out, err = nil, fmt.Errorf("extracting addresses: %v", r)
    }
}()
```

Options, cheapest first:

1. **Drop the `ValidateBasic` call**, keep the `recover`. Restores EVM txs;
   malformed input still degrades to an error rather than a panic.
2. **Skip it for EVM txs** — check for `*evmtypes.MsgEthereumTx` in `tx.GetMsgs()`
   first. More targeted, more code, same outcome.
3. **Guard only the `FeeTx` accessors** — wrap the `FeePayer()`/`FeeGranter()`
   calls specifically, since those are what panic.

**Recommend 1.** The `recover` already covers what `ValidateBasic` was added to
prevent.

**Regression test worth adding:** submit a real EVM tx through a node with
`x/compliance` enabled and assert it lands. A unit test on `InvolvedAddresses`
with an unsigned-Cosmos-but-valid-EVM tx would also catch it.

## Effect on this spike

Blocks the D14 perimeter test, which needs a pool deployed on a compliance-enabled
chain. Deferred until PR #10 is fixed; the relayer work (threat model §8's
remaining gate) is unaffected and proceeds first.
