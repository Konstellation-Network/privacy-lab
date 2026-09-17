// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Test, console} from 'forge-std/Test.sol';
import {ERC1967Proxy} from '@oz/proxy/ERC1967/ERC1967Proxy.sol';
import {IERC20} from '@oz/token/ERC20/IERC20.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {PrivacyPoolSimple} from 'contracts/implementations/PrivacyPoolSimple.sol';
import {CommitmentVerifier} from 'contracts/verifiers/CommitmentVerifier.sol';
import {WithdrawalVerifier} from 'contracts/verifiers/WithdrawalVerifier.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {IEntrypoint} from 'interfaces/IEntrypoint.sol';

import {IntegrationUtils} from '../integration/Utils.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

/// @notice privacy-lab P0-A: full deposit -> withdraw cycle with real Groth16 proofs,
/// standing on its own rather than on the upstream mainnet-shaped integration base.
/// Research only. Never run against a real network.
contract KonstellationWithdraw is IntegrationUtils {
  using InternalLeanIMT for LeanIMTData;

  uint256 constant SNARK_SCALAR_FIELD =
    21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617;
  address constant NATIVE_ASSET = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  Entrypoint internal entrypoint;
  PrivacyPoolSimple internal pool;
  address internal owner = makeAddr('owner');
  address internal depositor = makeAddr('depositor');
  address internal recipient = makeAddr('recipient');
  address internal relayer = makeAddr('relayer');

  function setUp() public {
    vm.startPrank(owner);
    WithdrawalVerifier wv = new WithdrawalVerifier();
    CommitmentVerifier cv = new CommitmentVerifier();
    Entrypoint impl = new Entrypoint();
    entrypoint = Entrypoint(
      payable(address(new ERC1967Proxy(address(impl), abi.encodeCall(Entrypoint.initialize, (owner, owner)))))
    );
    pool = new PrivacyPoolSimple(address(entrypoint), address(wv), address(cv));
    entrypoint.registerPool(IERC20(NATIVE_ASSET), IPrivacyPool(address(pool)), 1 ether, 0, 1000);
    vm.stopPrank();
  }

  function test_DepositThenWithdrawWithRealProof() public {
    uint256 value = 10 ether;
    vm.deal(depositor, value);

    // ---- deposit ----
    uint256 nullifier = _genSecretBySeed('nullifier');
    uint256 secret = _genSecretBySeed('secret');
    uint256 precommitment = _hashPrecommitment(nullifier, secret);
    // PrivacyPool computes the label with ++nonce, so the first deposit uses nonce 1.
    uint256 label = uint256(keccak256(abi.encodePacked(pool.SCOPE(), pool.nonce() + 1))) % SNARK_SCALAR_FIELD;

    vm.prank(depositor);
    uint256 gasBefore = gasleft();
    entrypoint.deposit{value: value}(precommitment);
    console.log('deposit gas', gasBefore - gasleft());

    uint256 commitment = _hashCommitment(value, label, precommitment);
    _insertIntoShadowMerkleTree(commitment);
    _insertIntoShadowASPMerkleTree(label);

    // publish the ASP root that approves this deposit
    vm.prank(owner);
    entrypoint.updateRoot(_shadowASPMerkleTree._root(), 'QmKonstellationSpikeASPRoot000001');

    // ---- withdraw (relayed) ----
    IPrivacyPool.Withdrawal memory withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(entrypoint), data: abi.encode(recipient, relayer, uint256(0))});
    uint256 context = uint256(keccak256(abi.encode(withdrawal, pool.SCOPE()))) % SNARK_SCALAR_FIELD;

    ProofLib.WithdrawProof memory proof = _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: commitment,
        withdrawnValue: 4 ether,
        context: context,
        label: label,
        existingValue: value,
        existingNullifier: nullifier,
        existingSecret: secret,
        newNullifier: _genSecretBySeed('newNullifier'),
        newSecret: _genSecretBySeed('newSecret')
      })
    );

    vm.prank(relayer);
    gasBefore = gasleft();
    entrypoint.relay(withdrawal, proof, pool.SCOPE());
    console.log('withdraw gas', gasBefore - gasleft());

    assertEq(recipient.balance, 4 ether, 'recipient must receive the withdrawn value');
    assertEq(address(pool).balance, 6 ether, 'pool must retain the remainder');
    assertTrue(pool.nullifierHashes(proof.pubSignals[1]), 'nullifier must be spent');
  }
}
