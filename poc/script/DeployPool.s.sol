// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Script, console} from 'forge-std/Script.sol';
import {ERC1967Proxy} from '@oz/proxy/ERC1967/ERC1967Proxy.sol';
import {IERC20} from '@oz/token/ERC20/IERC20.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {PrivacyPoolSimple} from 'contracts/implementations/PrivacyPoolSimple.sol';
import {CommitmentVerifier} from 'contracts/verifiers/CommitmentVerifier.sol';
import {WithdrawalVerifier} from 'contracts/verifiers/WithdrawalVerifier.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

/// @notice Stands up a native-KASH Privacy Pool on a local Konstellation node.
/// @dev privacy-lab P0-A spike. Research only — never run against a real network.
contract DeployPool is Script {
  address constant NATIVE_ASSET = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  function run() external {
    uint256 pk = vm.envUint('PRIVATE_KEY');
    address me = vm.addr(pk);
    vm.startBroadcast(pk);

    WithdrawalVerifier withdrawalVerifier = new WithdrawalVerifier();
    CommitmentVerifier ragequitVerifier = new CommitmentVerifier();

    // Entrypoint is UUPS: deploy implementation, then proxy, then initialize.
    Entrypoint impl = new Entrypoint();
    bytes memory initData = abi.encodeCall(Entrypoint.initialize, (me, me));
    ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
    Entrypoint entrypoint = Entrypoint(payable(address(proxy)));

    PrivacyPoolSimple pool =
      new PrivacyPoolSimple(address(entrypoint), address(withdrawalVerifier), address(ragequitVerifier));

    // minDeposit 1 KASH, vetting fee 0 bps, max relay fee 500 bps (5%)
    entrypoint.registerPool(IERC20(NATIVE_ASSET), IPrivacyPool(address(pool)), 1 ether, 0, 500);

    vm.stopBroadcast();

    console.log('withdrawalVerifier', address(withdrawalVerifier));
    console.log('ragequitVerifier  ', address(ragequitVerifier));
    console.log('entrypointImpl    ', address(impl));
    console.log('entrypoint        ', address(entrypoint));
    console.log('pool              ', address(pool));
    console.log('scope             ', pool.SCOPE());
  }
}
