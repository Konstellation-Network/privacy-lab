#!/usr/bin/env node
// privacy-lab P0-A: the gas-linkage gate.
//
// Deposits native KASH, publishes an ASP root, generates a real Groth16 proof,
// and asks the RELAYER to submit the withdrawal — so the recipient never sends a
// transaction and never pays gas. Threat model §4/§8: a withdrawal the recipient
// funds themselves relinks them publicly, so this is the test that matters.
//
// Research only. Never run against a real network.

import { PrivacyPoolSDK, Circuits, getCommitment } from "@0xbow/privacy-pools-core-sdk";
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import {
  createPublicClient, createWalletClient, http, parseEther,
  encodeFunctionData, keccak256, encodeAbiParameters, encodePacked,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const RELAYER = process.env.RELAYER_URL ?? "http://localhost:3000";
const ENTRYPOINT = process.env.ENTRYPOINT;
const POOL = process.env.POOL;
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 56670);
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const SNARK_F = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// dev0 deposits; dev2 receives and must never transact.
const DEPOSITOR_PK = process.env.DEPOSITOR_PK;
const RECIPIENT = process.env.RECIPIENT;

const chain = { id: CHAIN_ID, name: "konstellation-local", nativeCurrency: { name: "KASH", symbol: "KASH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const depositor = privateKeyToAccount(DEPOSITOR_PK);
const wallet = createWalletClient({ account: depositor, chain, transport: http(RPC) });

const entrypointAbi = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "_precommitment", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "updateRoot", stateMutability: "nonpayable", inputs: [{ name: "_root", type: "uint256" }, { name: "_ipfsCID", type: "string" }], outputs: [{ type: "uint256" }] },
];
const poolAbi = [
  { type: "function", name: "SCOPE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentRoot", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

const hash = (a, b) => poseidon([a, b]);
const rand = () => BigInt("0x" + [...crypto.getRandomValues(new Uint8Array(31))].map(b => b.toString(16).padStart(2, "0")).join(""));
const pad = (s, d = 32) => { const o = [...s]; while (o.length < d) o.push(0n); return o; };

async function main() {
  const scope = await pub.readContract({ address: POOL, abi: poolAbi, functionName: "SCOPE" });
  const nonceBefore = await pub.readContract({ address: POOL, abi: poolAbi, functionName: "nonce" });

  const value = parseEther("10");
  const nullifier = rand(), secret = rand();
  const precommitment = poseidon([nullifier, secret]);

  // PrivacyPool uses ++nonce, so the first deposit's label uses nonce+1 (finding 010).
  const label = BigInt(keccak256(encodePacked(["uint256", "uint256"], [scope, nonceBefore + 1n]))) % SNARK_F;

  console.log("depositing 10 KASH…");
  const depHash = await wallet.writeContract({ address: ENTRYPOINT, abi: entrypointAbi, functionName: "deposit", args: [precommitment], value });
  const depRc = await pub.waitForTransactionReceipt({ hash: depHash });
  console.log("  deposit gas", depRc.gasUsed.toString(), "status", depRc.status);

  const commitment = getCommitment(value, label, nullifier, secret);

  // Shadow trees mirroring the pool's state and the ASP set.
  const stateTree = new LeanIMT(hash); stateTree.insert(commitment.hash);
  const aspTree = new LeanIMT(hash);   aspTree.insert(label);

  const onchainRoot = await pub.readContract({ address: POOL, abi: poolAbi, functionName: "currentRoot" });
  if (onchainRoot !== stateTree.root) throw new Error(`state root mismatch: chain ${onchainRoot} vs shadow ${stateTree.root}`);
  console.log("  state root matches chain ✓");

  console.log("publishing ASP root…");
  const rootHash = await wallet.writeContract({ address: ENTRYPOINT, abi: entrypointAbi, functionName: "updateRoot", args: [aspTree.root, "QmKonstellationRelayerGateTest001"] });
  await pub.waitForTransactionReceipt({ hash: rootHash });

  // The relayer is the processooor; RelayData carries recipient, feeRecipient, feeBPS.
  const feeReceiver = process.env.FEE_RECEIVER;
  const withdrawalData = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [RECIPIENT, feeReceiver, 100n],
  );
  const withdrawal = { processooor: ENTRYPOINT, data: withdrawalData };
  const context = BigInt(keccak256(encodeAbiParameters(
    [{ components: [{ name: "processooor", type: "address" }, { name: "data", type: "bytes" }], type: "tuple" }, { type: "uint256" }],
    [withdrawal, scope],
  ))) % SNARK_F;

  console.log("generating Groth16 proof…");
  const t0 = Date.now();
  const sdk = new PrivacyPoolSDK(new Circuits({ browser: false }));
  const withdrawnValue = parseEther("4");
  const { proof, publicSignals } = await sdk.proveWithdrawal(commitment, {
    context,
    withdrawalAmount: withdrawnValue,
    stateMerkleProof: { root: stateTree.root, leaf: commitment.hash, index: 0n, siblings: pad(stateTree.generateProof(0).siblings) },
    aspMerkleProof:   { root: aspTree.root,   leaf: label,            index: 0n, siblings: pad(aspTree.generateProof(0).siblings) },
    stateRoot: stateTree.root, stateTreeDepth: stateTree.depth,
    aspRoot: aspTree.root,     aspTreeDepth: aspTree.depth,
    newSecret: rand(), newNullifier: rand(),
  });
  console.log(`  proof generated in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const recipientBefore = await pub.getBalance({ address: RECIPIENT });
  const txCountBefore = await pub.getTransactionCount({ address: RECIPIENT });

  console.log("POSTing to the relayer…");
  const res = await fetch(`${RELAYER}/relayer/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      withdrawal, scope: scope.toString(), chainId: CHAIN_ID,
      publicSignals: publicSignals.map(String),
      proof: { pi_a: proof.pi_a.map(String), pi_b: proof.pi_b.map(r => r.map(String)), pi_c: proof.pi_c.map(String) },
    }),
  });
  const body = await res.json();
  console.log("  relayer response", res.status, JSON.stringify(body));
  if (!res.ok || body.success === false) throw new Error("relayer refused the request");

  // Wait for the relayer's transaction to land.
  for (let i = 0; i < 40; i++) {
    const bal = await pub.getBalance({ address: RECIPIENT });
    if (bal > recipientBefore) {
      const txCountAfter = await pub.getTransactionCount({ address: RECIPIENT });
      console.log("\n=== GATE RESULT ===");
      console.log("recipient received :", (bal - recipientBefore).toString(), "wei");
      console.log("recipient tx count :", txCountBefore, "->", txCountAfter);
      console.log(txCountAfter === txCountBefore
        ? "PASS — recipient sent no transaction and paid no gas"
        : "FAIL — recipient transacted");
      return;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error("recipient balance never increased");
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
