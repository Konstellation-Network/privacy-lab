# Finding 015 — D14's perimeter, observed

**Date:** 2026-09-21
**Status:** deposit side and direct-transfer side **confirmed live**. Withdrawal
side in progress.
**Node:** `konstellationd` from `main` @ `a9051f6` (post PR #10), chain 56670,
`enforce: true`, 60 s timelocks, authority = validator key.

Converts [004](004-d14-perimeter-analysis.md) and
[008](008-asp-changes-the-d14-picture.md) from source analysis into observation.

## Test 1 — a frozen address cannot deposit ✅

Baseline first: dev3 unfrozen deposits 2 KASH → `status 1`, block 7370.

Then `emergency-freeze` dev3 (authority = `mykey`, `code: 0`), confirmed by the
precompile:

```
isFrozen(0x498B…26dA)                  → true
status(0x498B…26dA)                    → (verified=false, frozen=true, until=1789981353)
```

Same deposit again:

```
Error: -32000: kons1fx944mzagwdhx0wz7k9tfztc8g3lkfk6ghu62u: address is frozen
```

Rejected **at submission**, before inclusion, naming the bech32 address. This is
exactly D14's deposit-side claim and finding 004's prediction — `msg.sender` is
the tx signer, so the ante decorator sees it.

## Test 2 — a frozen address cannot be a direct EVM recipient ✅

An *unfrozen* sender (dev0) attempting a plain transfer **to** frozen dev3:

```
Error: -32000: kons1fx944mzagwdhx0wz7k9tfztc8g3lkfk6ghu62u: address is frozen
```

The decorator reads the EVM `to` field, so a visible recipient is covered even
when the sender is clean. Also as predicted.

## Test 3 — the pool CAN pay a frozen recipient ❌

The case that matters, because here the recipient is **not** in any field the
decorator reads — it is ABI-encoded inside `Withdrawal.data` and only decoded
during EVM execution.

Method: deposit 10 KASH, generate a real Groth16 proof naming dev3 as recipient,
freeze dev3 **after the proof is built** so the 60 s window is live, then submit
`Entrypoint.relay()` from an unfrozen account.

```
freezing the recipient NOW, with the proof already built…
submitting relay() directly from an unfrozen account…
  relay status success gas 489050

frozen recipient received: 3960000000000000000 wei
NOT ENFORCED — the pool paid a frozen address
```

Independently verified immediately afterwards, on the same live state:

| Check | Result |
|---|---|
| `isFrozen(0x498B…26dA)` | **true** — the freeze was genuinely live |
| dev3 attempts its own transfer | **`address is frozen`** — still blocked as a sender |
| dev3 balance | **+3.96 KASH** from the pool |

So the address was frozen, could not transact itself, and was paid anyway.

**Finding 004's prediction is confirmed by observation.** The ante decorator sees
only the `Entrypoint` as the EVM `to`; the real recipient is inside opaque
calldata, and the transfer happens inside EVM execution —
`ENGINEERING.md §10.1`'s documented blind spot.

### What this means in practice

This is **worse than the leak D14 accepts**. D14's case needs a *fresh, unlisted*
address the authority never had a claim on. This one needs nothing: an address
already on the block list can be paid directly out of the pool, today, by anyone
willing to submit the transaction.

What still holds: the frozen address cannot *deposit* (test 1), cannot be a
*direct* recipient (test 2), and — per [008](008-asp-changes-the-d14-picture.md) —
cannot withdraw at all if the ASP set excludes its label. **The ASP is the control
that actually covers this case**, not the ante decorator.

That makes the ASP operator's curation load-bearing rather than advisory, and
sharpens the recommendation in 008: if a pool ever ships, the association set is
the enforcement point, and whoever publishes it holds a key of the same class as
the freeze authority.

## A real operational lesson, found by accident

The first attempt at test 3 failed for a reason worth recording: **the freeze
expired mid-test.** `emergency-freeze` lasts one timelock — 60 s on this dev chain
— and proof generation takes longer than that. By the time the withdrawal was
ready, `isFrozen` had returned to `false` and the entry had been swept.

That is correct D6 behaviour ("auto-expires unless ratified"), and it surfaces a
genuine operational point for mainnet: **an emergency freeze is a holding action,
not an enforcement mechanism.** With a 24 h mainnet timelock the window is far
wider, but the shape is the same — if nobody ratifies through the timelocked path,
the freeze lapses on its own. Any runbook built on emergency freeze needs a
ratification step, or the freeze silently expires.

Worth a line in `infra/runbooks/` when compliance procedures get written.
