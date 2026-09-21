#!/usr/bin/env node
// privacy-lab P0-A: threat model P4 — can a wallet reconstruct its balance from
// chain data plus keys alone, and what does it ask the RPC for?
//
// Counts every JSON-RPC call the SDK makes, and records whether any query is
// narrowed to this user (which would leak interest to the RPC provider).

import { createPublicClient, http, parseAbiItem } from "viem";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const POOL = process.env.POOL;
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 56670);

const DEPOSIT_EVENT = parseAbiItem('event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _merkleRoot)');
const WITHDRAWAL_EVENT = parseAbiItem('event Withdrawn(address indexed _processooor, uint256 _value, uint256 _spentNullifier, uint256 _newCommitment)');

// Wrap the transport so every RPC call is logged.
const calls = [];
const base = http(RPC);
const counting = (cfg) => {
  const t = base(cfg);
  return { ...t, request: async (args) => { calls.push(args); return t.request(args); } };
};

const chain = { id: CHAIN_ID, name: "konstellation-local", nativeCurrency: { name: "KASH", symbol: "KASH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: counting });

// Konstellation caps eth_getLogs at 10,000 blocks, so a wallet must paginate.
const CHUNK = 9000n;
const head = await pub.getBlockNumber();
async function scan(event) {
  const out = [];
  for (let from = 0n; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
    out.push(...await pub.getLogs({ address: POOL, event, fromBlock: from, toBlock: to }));
  }
  return out;
}
const deposits = await scan(DEPOSIT_EVENT);
const withdrawals = await scan(WITHDRAWAL_EVENT);
console.log(`chain head ${head}, scanned in ${Math.ceil(Number(head)/Number(CHUNK))} chunk(s) of ${CHUNK}`);

console.log("=== what the wallet fetched ===");
console.log("deposit events   :", deposits.length);
console.log("withdrawal events:", withdrawals.length);

console.log("\n=== every RPC call made ===");
for (const c of calls) {
  const p = c.params?.[0] ?? {};
  const filtered = p.topics?.slice(1).some(t => t != null);
  console.log(` ${c.method}  address=${p.address ?? "-"}  user-filtered=${filtered ? "YES" : "no"}`);
}

console.log("\n=== P4 / §3 assessment ===");
const anyUserFiltered = calls.some(c => (c.params?.[0]?.topics ?? []).slice(1).some(t => t != null));
console.log(anyUserFiltered
  ? "LEAK — a query was narrowed to this user; the RPC provider learns who is asking"
  : "OK — queries are pool-wide; the RPC provider sees interest in the pool, not in a user");
console.log("commitments visible to anyone:", deposits.length, "(matching to an owner must happen locally)");
