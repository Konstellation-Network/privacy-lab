# Finding 004 — D14's perimeter maps onto Privacy Pools, with one gap

**Date:** 2026-09-17
**Status:** analysis of pinned source. Not yet executed against a node.
**Subject:** `0xbow-io/privacy-pools-core` @ `c312dcd5`, Apache-2.0, solc 0.8.28.

## Summary

D14 says the ante decorator gates the shield/unshield perimeter and cannot reach the
shielded interior. Reading the contracts, **the deposit half maps cleanly and the
withdrawal half does not.** The withdrawal recipient is not visible to the chain in
any field an ante decorator can read.

That does not break D14 — D14 already accepts that the interior is unenforceable.
But it moves one case from "enforced" to "not enforced" relative to what the
threat model §5 diagram implies, so it needs recording before anyone relies on it.

## Deposit: enforced, no new code

```solidity
function deposit(uint256 _precommitment) external payable nonReentrant returns (uint256 _commitment)
```

A native-KASH deposit is an ordinary EVM transaction. `msg.sender` is the depositor
and is the tx signer, so `x/compliance`'s ante decorator sees it via
`MsgEthereumTx.GetSender()` and rejects a frozen depositor with no integration work.

**Confirms D14's deposit-side claim exactly.**

Also confirms the `payable` native path, so **WKASH wrapping is not required** —
one step simpler than the RAILGUN plan assumed (finding 002).

## Withdrawal: NOT enforced by the ante decorator

```solidity
function relay(Withdrawal calldata _withdrawal, WithdrawProof calldata _proof, uint256 _scope) external
```

with

```solidity
struct Withdrawal { address processooor; bytes data; }
```

The recipient is not a struct field. It is ABI-encoded inside `data`, decoded only
once execution is underway:

```solidity
RelayData memory _data = abi.decode(_withdrawal.data, (RelayData));
_transfer(_asset, _data.recipient, _amountAfterFees);
```

`x/compliance/ante`'s `InvolvedAddresses` extracts the EVM `to` — which here is the
**Entrypoint contract**, not the recipient. The real recipient is inside opaque
calldata the decorator does not decode, and the transfer happens inside EVM
execution, which `ENGINEERING.md §10.1` already lists as unreachable.

**So a frozen address can receive a withdrawal.** The freeze is not evaded by the
cryptography; it is simply invisible to a decorator that reads message structure.

### Why this is worse than the leak D14 already accepts

D14 accepts: shield before a freeze, unshield to a *fresh unlisted* address after.
Bounded, and the freeze authority never had a claim on a fresh address.

This is different: an address that is **already on the block list** can be paid
directly out of the pool. No timing trick required.

## What closes it

The precompile at `0x…0900` exists for exactly this — contracts enforcing what the
chain cannot see (`ENGINEERING.md §10.1`). Options, cheapest first:

1. **A wrapper contract in front of `relay`** that decodes `RelayData`, calls
   `isFrozen(_data.recipient)` on the precompile, and reverts. No fork of upstream;
   an ordinary contract we deploy and point users at. Weakness: only binding if
   everyone uses the wrapper — `Entrypoint.relay` stays callable directly.
2. **A patched `Entrypoint`** with the check inside `relay`. Binding for that pool,
   but it is a modification of audited Apache-2.0 code, so our fork carries the
   audit gap. Apache-2.0 permits it; the D9 scope grows.
3. **Accept and document**, extending D14's accepted leak to cover it. Cheapest,
   and defensible only if stated publicly rather than discovered.

**Recommendation: 2 for anything holding real funds, 3 for the spike.** Option 1
reads well and enforces nothing an attacker must respect.

None of this blocks P0-A. It changes what the spike must *test* — the threat model
§8 line "a frozen address is refused at the perimeter" now has two halves, and the
honest expected result is: deposit refused, withdrawal **not** refused.

## Also worth noting

`relay` pays `_data.feeRecipient` as well as `_data.recipient`. A compliance check
that covers one and not the other leaves an obvious hole, since the fee split is
attacker-chosen up to `maxRelayFeeBPS`.

## Not yet verified

Source analysis only. Still to do: compile against solc 0.8.28, deploy to the local
chain (56670), measure gas, and run the two perimeter cases against a binary built
from `x-compliance` (`main` has no `x/compliance` — finding 003).
