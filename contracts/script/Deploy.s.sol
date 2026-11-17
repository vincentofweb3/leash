// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Leash} from "../src/Leash.sol";
import {MockUSD8} from "../src/mocks/MockUSD8.sol";

/// @notice Deploys Leash.
///   - Aevum testnet and `make fork`: wires the real tUSD8 as the settlement token.
///   - `make anvil` (chain 31337) only: deploys MockUSD8 first and mints 1,000 to the deployer.
///   - Anywhere else it stops, rather than point policy enforcement at an arbitrary token.
///
///   make deploy-local                       # anvil on 127.0.0.1:8545
///   make deploy-aevum ACCOUNT=aevum-deployer
contract Deploy is Script {
    address constant AEVUM_TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;
    uint256 constant ANVIL_CHAIN = 31337;

    function run() external returns (Leash leash, address token) {
        vm.startBroadcast();

        if (AEVUM_TUSD8.code.length > 0) {
            token = AEVUM_TUSD8;
        } else {
            require(block.chainid == ANVIL_CHAIN, "tUSD8 not found. Check the RPC (Aevum testnet is chain 44005).");
            (, address deployer,) = vm.readCallers();
            MockUSD8 mock = new MockUSD8();
            mock.mint(deployer, 1_000e6);
            token = address(mock);
        }
        leash = new Leash(IERC20(token));
        vm.stopBroadcast();

        console.log("chainId ", block.chainid);
        console.log("token   ", token);
        console.log("Leash   ", address(leash));
    }
}
