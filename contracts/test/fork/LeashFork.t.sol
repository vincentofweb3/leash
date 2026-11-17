// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Leash} from "../../src/Leash.sol";
import {Signing} from "../Signing.sol";

interface ITUSD8 is IERC20 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/// @notice Runs Leash against the REAL tUSD8 on a local fork of Aevum testnet. No funds needed:
///         `deal` writes balances into the fork only.
///         Run with: make test-fork
contract LeashForkTest is Test {
    ITUSD8 constant TUSD8 = ITUSD8(0x456569838f1d43009A91ebA4263147Afd7233483);

    Leash leash;
    uint256 agentKey;
    address agentAddr;
    address vendor;
    bytes32 domain;

    function test_realTusd8_domain() public view {
        assertEq(block.chainid, 44005, "run with --fork-url aevum");
    }

    function test_realTusd8_createApproveSpendRevoke() public {
        (address buyer,) = makeAddrAndKey("fork-buyer");
        (agentAddr, agentKey) = makeAddrAndKey("fork-agent");
        vendor = makeAddr("fork-vendor");

        leash = new Leash(TUSD8);
        deal(address(TUSD8), buyer, 50e6);
        domain = _leashDomain();

        vm.prank(buyer);
        TUSD8.approve(address(leash), 30e6);

        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(buyer);
        uint256 id = leash.createPolicy(agentAddr, 10e6, 30e6, 0, expiry, bytes32(0), new address[](0));

        Leash.SpendAuth memory a = _auth(id, vendor, 7e6, keccak256("fork-nonce-1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);

        assertEq(TUSD8.balanceOf(vendor), 7e6);
        assertEq(TUSD8.balanceOf(buyer), 43e6);
        assertEq(leash.remainingBudget(id), 23e6);

        vm.prank(buyer);
        leash.revoke(id);

        Leash.SpendAuth memory b = _auth(id, vendor, 1e6, keccak256("fork-nonce-2"), uint64(block.timestamp + 2 hours));
        (uint8 v2, bytes32 r2, bytes32 s2) = _sign(b);
        vm.expectRevert(Leash.Revoked.selector);
        leash.spend(b, v2, r2, s2);
        assertEq(TUSD8.balanceOf(buyer), 43e6);
    }

    function _auth(uint256 policyId, address _vendor, uint256 amount, bytes32 nonce, uint64 expiresAt)
        internal
        view
        returns (Leash.SpendAuth memory)
    {
        return Leash.SpendAuth({
            policyId: policyId,
            agent: agentAddr,
            vendor: _vendor,
            amount: amount,
            purposeHash: keccak256("fork-invoice"),
            nonce: nonce,
            expiresAt: expiresAt
        });
    }

    function _sign(Leash.SpendAuth memory a) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        return Signing.signSpend(
            vm,
            agentKey,
            domain,
            Signing.Spend({
                policyId: a.policyId, agent: a.agent, vendor: a.vendor, amount: a.amount,
                purposeHash: a.purposeHash, nonce: a.nonce, expiresAt: a.expiresAt
            })
        );
    }

    function _leashDomain() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Leash"),
                keccak256("1"),
                uint256(44005),
                address(leash)
            )
        );
    }
}
