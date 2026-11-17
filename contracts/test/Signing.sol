// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/// @dev Builds EIP-712 SpendAuth signatures, the same way the leash CLI does.
library Signing {
    bytes32 internal constant SPEND_TYPEHASH = keccak256(
        "SpendAuth(uint256 policyId,address agent,address vendor,uint256 amount,bytes32 purposeHash,bytes32 nonce,uint64 expiresAt)"
    );

    struct Spend {
        uint256 policyId;
        address agent;
        address vendor;
        uint256 amount;
        bytes32 purposeHash;
        bytes32 nonce;
        uint64 expiresAt;
    }

    function signSpend(Vm vm, uint256 pk, bytes32 domainSeparator, Spend memory s)
        internal
        pure
        returns (uint8 v, bytes32 r, bytes32 t)
    {
        bytes32 structHash = keccak256(
            abi.encode(SPEND_TYPEHASH, s.policyId, s.agent, s.vendor, s.amount, s.purposeHash, s.nonce, s.expiresAt)
        );
        return vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)));
    }
}
