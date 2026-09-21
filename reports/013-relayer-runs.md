# Finding 013 — The relayer runs against Konstellation

**Date:** 2026-09-21
**Status:** service up and answering. The end-to-end relayed withdrawal is still
to come.
**Node:** `konstellationd` from `main` @ `a9051f6` (post PR #10 and #12), chain 56670.
**Subject:** `0xbow-io/privacy-pools-core` @ `c312dcd5`, `packages/relayer`.

## Why this matters

The threat model §4 and §8 call the relayer a **gate, not a stretch goal**. Without
it, a withdrawal recipient funds their own gas, and that funding transaction
publicly relinks the fresh address to its owner — the privacy guarantee collapses
at first spend with no attack on the cryptography.

## Result

`yarn build` clean. Service starts, binds :3000, answers for our chain.

```
$ GET /relayer/details?chainId=56670&assetAddress=0xEeee…EEeE
{
  "feeBPS": "100",
  "feeReceiverAddress": "0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17",
  "chainId": 56670,
  "assetAddress": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "minWithdrawAmount": "1000000000000000000",
  "maxGasPrice": "100000000000"
}
```

```
$ POST /relayer/quote  {"chainId":56670,"asset":"0xEeee…EEeE","amount":"4e18","extraGas":false}
{
  "baseFeeBPS": "100",
  "feeBPS": "100",
  "gasPrice": "0",
  "detail": { "relayTxCost": { "gas": "650000", "eth": "0" } }
}
```

`gasPrice: "0"` is the dev chain's zero min-gas-price, not a bug. `relayTxCost`
650,000 gas is the relayer's own estimate for submitting a withdrawal; measured
withdrawal cost was 465,153 ([010](010-withdrawal-works.md)), so its estimate is
conservative by ~40%.

Configured against: chain 56670, our `Entrypoint` at
`0x28108934A16e88cAC49dD4A527fe9A87CE526173`, native KASH, 100 bps fee, 1 KASH
minimum. Relayer signer is dev1 (`0x963EBDf2…`), funded with 100,000 KASH.

## Uniswap is a dependency but not a blocker

`@uniswap/sdk-core`, `v3-sdk` and `universal-router-sdk` are hard npm dependencies,
which looked like a problem for a chain with no DEX. Reading
`src/services/quote.service.ts:53`:

```ts
if (assetAddress.toLowerCase() === NativeAddress.toLowerCase()) {
  quote = { num: 1n, den: 1n, path: [] };     // native: 1:1, no swap
} else {
  quote = await quoteProvider.quoteNativeTokenInERC20(chainId, assetAddress, amountIn);
}
```

For the native asset the relayer short-circuits to a 1:1 quote and **never calls
Uniswap**. Confirmed live — the quote above returned without any swap lookup.

This holds only while V1 stays native-KASH-only (threat model Q4). **An ERC-20
pool on Konstellation would need a Uniswap v3 deployment, or a patched quote
provider.** Worth recording as a constraint on widening scope later.

## An upstream config bug

Starting with a config that omits `allowed_domains` crashes on a zod validation
error. The schema's default is a single comma-joined string where an array of URLs
is expected:

```ts
allowed_domains: z.array(z.string().url()).default([
  "https://testnet.privacypools.com, https://prod-privacy-pool-ui.vercel.app, …"
])
```

One element containing commas, so `.url()` rejects it. **Workaround:** always set
`allowed_domains` explicitly. Not Konstellation-specific — it would fail anywhere
the default is used. Second upstream packaging bug after the remappings one in
[005](005-build-result.md).

## What is not yet proven

The service answers; it has not yet **relayed a withdrawal**. The remaining step is
a full cycle where the relayer submits the transaction and the recipient pays no
gas — which is the actual gate. That needs the SDK-side request flow
(`POST /relayer/request`) driven with a real proof.

Until that runs, the gas-linkage gate is **not** cleared.
