// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Leash} from "../src/Leash.sol";
import {MockUSD8} from "../src/mocks/MockUSD8.sol";
import {Signing} from "./Signing.sol";

contract LeashTest is Test {
    MockUSD8 token;
    Leash leash;

    address buyer;
    uint256 buyerKey;
    address agentAddr;
    uint256 agentKey;
    address merchant = makeAddr("merchant");
    address merchant2 = makeAddr("merchant2");

    uint256 constant CAP = 10e6;      // 10 tUSD8 per tx
    uint256 constant BUDGET = 100e6;  // 100 tUSD8 total
    uint64 expiry;

    function setUp() public {
        (buyer, buyerKey) = makeAddrAndKey("buyer");
        (agentAddr, agentKey) = makeAddrAndKey("agent");
        token = new MockUSD8();
        leash = new Leash(IERC20(address(token)));
        token.mint(buyer, 1_000e6);
        vm.prank(buyer);
        token.approve(address(leash), 500e6);
        expiry = uint64(block.timestamp + 30 days);
    }

    // ---------- helpers ----------

    function _defaults() internal view returns (uint256, uint256, uint64, uint64, bytes32, address[] memory) {
        return (CAP, BUDGET, 0, expiry, bytes32(0), new address[](0));
    }

    function _create() internal returns (uint256 id) {
        vm.prank(buyer);
        id = leash.createPolicy(agentAddr, CAP, BUDGET, 0, expiry, bytes32(0), new address[](0));
    }

    function _createWith(uint256 cap, uint256 budget, uint64 dailyCap, uint64 exp, address[] memory list)
        internal
        returns (uint256 id)
    {
        vm.prank(buyer);
        id = leash.createPolicy(agentAddr, cap, budget, dailyCap, exp, bytes32(0), list);
    }

    function _domainSeparator() internal view returns (bytes32) {
        // EIP712 domain separator, recomputed from the OZ rules.
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Leash"),
                keccak256("1"),
                block.chainid,
                address(leash)
            )
        );
    }

    function _spendAuth(uint256 id, address vendor, uint256 amount, bytes32 nonce, uint64 expiresAt)
        internal
        view
        returns (Leash.SpendAuth memory)
    {
        return Leash.SpendAuth({
            policyId: id,
            agent: agentAddr,
            vendor: vendor,
            amount: amount,
            purposeHash: keccak256("invoice-1042"),
            nonce: nonce,
            expiresAt: expiresAt
        });
    }

    function _sign(Leash.SpendAuth memory auth) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        Signing.Spend memory a = Signing.Spend({
            policyId: auth.policyId,
            agent: auth.agent,
            vendor: auth.vendor,
            amount: auth.amount,
            purposeHash: auth.purposeHash,
            nonce: auth.nonce,
            expiresAt: auth.expiresAt
        });
        return Signing.signSpend(vm, agentKey, _domainSeparator(), a);
    }

    // ========== createPolicy ==========

    function test_createPolicy_storesFields() public {
        uint256 id = _create();
        Leash.Policy memory p = leash.policyOf(id);
        assertEq(p.buyer, buyer);
        assertEq(p.agent, agentAddr);
        assertEq(p.perTxCap, CAP);
        assertEq(p.budget, BUDGET);
        assertEq(p.spent, 0);
        assertEq(p.expiry, expiry);
        assertEq(p.dailyCap, 0);
        assertFalse(p.revoked);
        assertEq(leash.nextPolicyId(), 1);
    }

    function test_createPolicy_emitsEvent() public {
        vm.expectEmit(true, true, true, true, address(leash));
        emit Leash.PolicyCreated(0, buyer, agentAddr, CAP, BUDGET, 0, expiry, bytes32(0), 0);
        vm.prank(buyer);
        leash.createPolicy(agentAddr, CAP, BUDGET, 0, expiry, bytes32(0), new address[](0));
    }

    function test_createPolicy_zeroAgentReverts() public {
        vm.prank(buyer);
        vm.expectRevert(Leash.ZeroAddress.selector);
        leash.createPolicy(address(0), CAP, BUDGET, 0, expiry, bytes32(0), new address[](0));
    }

    function test_createPolicy_zeroPerTxCapReverts() public {
        vm.prank(buyer);
        vm.expectRevert(Leash.BadPerTxCap.selector);
        leash.createPolicy(agentAddr, 0, BUDGET, 0, expiry, bytes32(0), new address[](0));
    }

    function test_createPolicy_perTxCapAboveBudgetReverts() public {
        vm.prank(buyer);
        vm.expectRevert(Leash.BadPerTxCap.selector);
        leash.createPolicy(agentAddr, BUDGET + 1, BUDGET, 0, expiry, bytes32(0), new address[](0));
    }

    function test_createPolicy_zeroBudgetReverts() public {
        vm.prank(buyer);
        vm.expectRevert(Leash.BadBudget.selector);
        leash.createPolicy(agentAddr, CAP, 0, 0, expiry, bytes32(0), new address[](0));
    }

    function test_createPolicy_pastExpiryReverts() public {
        vm.prank(buyer);
        vm.expectRevert(Leash.PolicyExpired.selector);
        leash.createPolicy(agentAddr, CAP, BUDGET, 0, uint64(block.timestamp), bytes32(0), new address[](0));
    }

    function test_createPolicy_allowlistTooLargeReverts() public {
        address[] memory list = new address[](17);
        for (uint256 i = 0; i < list.length; i++) list[i] = makeAddr(string(abi.encodePacked("v", i)));
        vm.prank(buyer);
        vm.expectRevert(Leash.AllowlistTooLarge.selector);
        leash.createPolicy(agentAddr, CAP, BUDGET, 0, expiry, bytes32(0), list);
    }

    function test_createPolicy_zeroVendorInAllowlistReverts() public {
        address[] memory list = new address[](2);
        list[0] = merchant;
        list[1] = address(0);
        vm.prank(buyer);
        vm.expectRevert(Leash.ZeroAddress.selector);
        leash.createPolicy(agentAddr, CAP, BUDGET, 0, expiry, bytes32(0), list);
    }

    function test_createPolicy_incrementsId() public {
        uint256 a = _create();
        uint256 b = _create();
        assertEq(a, 0);
        assertEq(b, 1);
    }

    function test_createPolicy_labelHashStored() public {
        bytes32 label = keccak256("cloud-invoices");
        vm.prank(buyer);
        uint256 id = leash.createPolicy(agentAddr, CAP, BUDGET, 0, expiry, label, new address[](0));
        assertEq(leash.policyOf(id).labelHash, label);
    }

    // ========== spend: happy path ==========

    function test_spend_movesFundsAndAccrues() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 4e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);

        vm.expectEmit(true, true, false, true, address(leash));
        emit Leash.Spent(id, merchant, 4e6, a.purposeHash, a.nonce, 4e6);
        vm.prank(makeAddr("relayer"));
        leash.spend(a, v, r, s);

        assertEq(token.balanceOf(merchant), 4e6);
        assertEq(token.balanceOf(buyer), 1_000e6 - 4e6);
        assertEq(leash.policyOf(id).spent, 4e6);
        assertEq(leash.remainingBudget(id), BUDGET - 4e6);
        assertTrue(leash.usedNonce(id, a.nonce));
    }

    function test_spend_secondSpendAccumulates() public {
        uint256 id = _create();
        for (uint256 i = 0; i < 3; i++) {
            Leash.SpendAuth memory a = _spendAuth(id, merchant, 2e6, keccak256(abi.encodePacked("n", i)), uint64(block.timestamp + 1 hours));
            (uint8 v, bytes32 r, bytes32 s) = _sign(a);
            leash.spend(a, v, r, s);
        }
        assertEq(leash.policyOf(id).spent, 6e6);
        assertEq(token.balanceOf(merchant), 6e6);
    }

    function test_spend_exactBudgetDrained() public {
        uint256 id = _createWith(BUDGET, BUDGET, 0, expiry, new address[](0));
        Leash.SpendAuth memory a = _spendAuth(id, merchant, BUDGET, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);
        assertEq(leash.remainingBudget(id), 0);
    }

    function test_spend_nonceScopedPerPolicy() public {
        uint256 a1 = _create();
        uint256 a2 = _create();
        bytes32 nonce = keccak256("shared");
        Leash.SpendAuth memory s1 = _spendAuth(a1, merchant, 1e6, nonce, uint64(block.timestamp + 1 hours));
        Leash.SpendAuth memory s2 = _spendAuth(a2, merchant, 1e6, nonce, uint64(block.timestamp + 1 hours));
        (uint8 v1, bytes32 r1, bytes32 t1) = _sign(s1);
        (uint8 v2, bytes32 r2, bytes32 t2) = _sign(s2);
        leash.spend(s1, v1, r1, t1);
        leash.spend(s2, v2, r2, t2); // same nonce, different policy: allowed
    }

    function test_spend_anyoneCanSubmit() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.prank(makeAddr("stranger"));
        leash.spend(a, v, r, s); // no MetaMask of the buyer needed; agent sig is the auth
    }

    // ========== spend: failure modes ==========

    function test_spend_replayReverts() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);
        vm.expectRevert(Leash.NonceUsed.selector);
        leash.spend(a, v, r, s);
    }

    function test_spend_wrongSignerReverts() public {
        uint256 id = _create();
        (, uint256 evilKey) = makeAddrAndKey("evil");
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        Signing.Spend memory s = Signing.Spend({policyId: a.policyId, agent: a.agent, vendor: a.vendor, amount: a.amount, purposeHash: a.purposeHash, nonce: a.nonce, expiresAt: a.expiresAt});
        (uint8 v, bytes32 r, bytes32 t) = Signing.signSpend(vm, evilKey, _domainSeparator(), s);
        vm.expectRevert(Leash.BadSignature.selector);
        leash.spend(a, v, r, t);
    }

    function test_spend_authAgentMismatchReverts() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        a.agent = makeAddr("someoneElse");
        vm.expectRevert(Leash.SpendAuthAgentMismatch.selector);
        leash.spend(a, 0, bytes32(0), bytes32(0));
    }

    function test_spend_zeroVendorReverts() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, address(0), 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        vm.expectRevert(Leash.ZeroVendor.selector);
        leash.spend(a, 0, bytes32(0), bytes32(0));
    }

    function test_spend_zeroAmountReverts() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 0, keccak256("n1"), uint64(block.timestamp + 1 hours));
        vm.expectRevert(Leash.ZeroAmount.selector);
        leash.spend(a, 0, bytes32(0), bytes32(0));
    }

    function test_spend_exceedsPerTxCapReverts() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, CAP + 1, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.expectRevert(Leash.ExceedsPerTxCap.selector);
        leash.spend(a, v, r, s);
    }

    function test_spend_exceedsBudgetAcrossSpendsReverts() public {
        uint256 id = _create();
        vm.startPrank(buyer);
        token.approve(address(leash), 500e6);
        vm.stopPrank();
        for (uint256 i = 0; i < 10; i++) {
            Leash.SpendAuth memory a = _spendAuth(id, merchant, CAP, keccak256(abi.encodePacked("n", i)), uint64(block.timestamp + 1 hours));
            (uint8 v, bytes32 r, bytes32 s) = _sign(a);
            leash.spend(a, v, r, s); // 100 tUSD8 = full budget
        }
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1, keccak256("one-too-many"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.expectRevert(Leash.ExceedsBudget.selector);
        leash.spend(a, v, r, s);
    }

    function test_spend_perTxCapEnforcedAtExactLimit() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, CAP, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);
        assertEq(leash.policyOf(id).spent, CAP);
    }

    function test_spend_expiredSpendAuthReverts() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.expectRevert(Leash.SpendExpired.selector);
        leash.spend(a, v, r, s);
    }

    function test_spend_afterPolicyExpiryReverts() public {
        uint64 soon = uint64(block.timestamp + 1 hours);
        uint256 id = _createWith(CAP, BUDGET, 0, soon, new address[](0));
        vm.warp(block.timestamp + 2 hours);
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 days));
        vm.expectRevert(Leash.PolicyExpired.selector);
        leash.spend(a, 0, bytes32(0), bytes32(0));
    }

    function test_spend_insufficientAllowanceReverts() public {
        uint256 id = _create();
        vm.prank(buyer);
        token.approve(address(leash), 1e6); // shrink below the 4e6 spend
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 4e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.expectRevert(abi.encodeWithSelector(Leash.AllowanceTooSmall.selector, 1e6));
        leash.spend(a, v, r, s);
        assertEq(token.allowance(buyer, address(leash)), 1e6);
    }

    // ========== daily cap ==========

    function test_spend_dailyCapEnforced() public {
        uint64 daily = 25e6;
        uint256 id = _createWith(CAP, BUDGET, daily, expiry, new address[](0));
        for (uint256 i = 0; i < 2; i++) {
            Leash.SpendAuth memory a = _spendAuth(id, merchant, CAP, keccak256(abi.encodePacked("n", i)), uint64(block.timestamp + 1 hours));
            (uint8 v, bytes32 r, bytes32 s) = _sign(a);
            leash.spend(a, v, r, s);
        }
        // 20 spent of a 25 daily cap — the third would push it to 30 and must fail
        Leash.SpendAuth memory a3 = _spendAuth(id, merchant, CAP, keccak256("n3"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a3);
        vm.expectRevert(Leash.ExceedsDailyCap.selector);
        leash.spend(a3, v, r, s);
        assertEq(token.balanceOf(merchant), 20e6);
    }

    function test_spend_dailyCapResetsNextDay() public {
        uint64 daily = 11e6;
        uint256 id = _createWith(CAP, BUDGET, daily, expiry, new address[](0));
        Leash.SpendAuth memory a = _spendAuth(id, merchant, CAP, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);
        assertEq(leash.todaySpent(id), CAP);
        vm.warp(block.timestamp + 1 days);
        assertEq(leash.todaySpent(id), 0);
        Leash.SpendAuth memory a2 = _spendAuth(id, merchant, CAP, keccak256("n2"), uint64(block.timestamp + 1 days));
        (uint8 v2, bytes32 r2, bytes32 s2) = _sign(a2);
        leash.spend(a2, v2, r2, s2); // allowed again on the new day
    }

    // ========== allowlist ==========

    function test_spend_allowlistRejectsStranger() public {
        address[] memory list = new address[](1);
        list[0] = merchant;
        uint256 id = _createWith(CAP, BUDGET, 0, expiry, list);
        Leash.SpendAuth memory a = _spendAuth(id, merchant2, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.expectRevert(Leash.VendorNotAllowed.selector);
        leash.spend(a, v, r, s);
    }

    function test_spend_allowlistPermitsListedVendor() public {
        address[] memory list = new address[](1);
        list[0] = merchant;
        uint256 id = _createWith(CAP, BUDGET, 0, expiry, list);
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);
        assertEq(token.balanceOf(merchant), 1e6);
    }

    function test_setAllowlist_replacesList() public {
        uint256 id = _create();
        address[] memory list = new address[](1);
        list[0] = merchant2;
        vm.prank(buyer);
        leash.setAllowlist(id, list);
        assertEq(leash.allowlistOf(id)[0], merchant2);
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.expectRevert(Leash.VendorNotAllowed.selector);
        leash.spend(a, v, r, s);
    }

    function test_setAllowlist_emptyMeansOpen() public {
        address[] memory list = new address[](1);
        list[0] = merchant;
        uint256 id = _createWith(CAP, BUDGET, 0, expiry, list);
        vm.prank(buyer);
        leash.setAllowlist(id, new address[](0));
        Leash.SpendAuth memory a = _spendAuth(id, merchant2, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);
    }

    function test_setAllowlist_onlyBuyer() public {
        uint256 id = _create();
        vm.prank(makeAddr("notBuyer"));
        vm.expectRevert(Leash.NotBuyer.selector);
        leash.setAllowlist(id, new address[](0));
    }

    // ========== revoke ==========

    function test_revoke_killsSessionKey() public {
        uint256 id = _create();
        vm.prank(buyer);
        leash.revoke(id);
        assertTrue(leash.policyOf(id).revoked);
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        vm.expectRevert(Leash.Revoked.selector);
        leash.spend(a, v, r, s);
    }

    function test_revoke_emitsEvent() public {
        uint256 id = _create();
        vm.expectEmit(true, true, false, false, address(leash));
        emit Leash.PolicyRevoked(id, buyer);
        vm.prank(buyer);
        leash.revoke(id);
    }

    function test_revoke_onlyBuyer() public {
        uint256 id = _create();
        vm.prank(makeAddr("notBuyer"));
        vm.expectRevert(Leash.NotBuyer.selector);
        leash.revoke(id);
    }

    function test_revoke_isIdempotentForBuyer() public {
        uint256 id = _create();
        vm.startPrank(buyer);
        leash.revoke(id);
        leash.revoke(id); // second call does not revert
        vm.stopPrank();
        assertTrue(leash.policyOf(id).revoked);
    }

    // ========== setLimits / extend ==========

    function test_setLimits_raiseCaps() public {
        uint256 id = _create();
        vm.prank(buyer);
        leash.setLimits(id, 20e6, 200e6, 25e6);
        Leash.Policy memory p = leash.policyOf(id);
        assertEq(p.perTxCap, 20e6);
        assertEq(p.budget, 200e6);
        assertEq(p.dailyCap, 25e6);
    }

    function test_setLimits_budgetBelowSpentReverts() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, CAP, keccak256("n1"), uint64(block.timestamp + 1 hours));
        (uint8 v, bytes32 r, bytes32 s) = _sign(a);
        leash.spend(a, v, r, s);
        vm.prank(buyer);
        vm.expectRevert(Leash.BadBudget.selector);
        leash.setLimits(id, CAP, CAP - 1, 0);
    }

    function test_setLimits_perTxCapAboveBudgetReverts() public {
        uint256 id = _create();
        vm.prank(buyer);
        vm.expectRevert(Leash.BadPerTxCap.selector);
        leash.setLimits(id, 200e6, 100e6, 0);
    }

    function test_setLimits_onlyBuyer() public {
        uint256 id = _create();
        vm.prank(makeAddr("notBuyer"));
        vm.expectRevert(Leash.NotBuyer.selector);
        leash.setLimits(id, CAP, BUDGET, 0);
    }

    function test_extend_onlyForward() public {
        uint256 id = _create();
        vm.prank(buyer);
        vm.expectRevert(Leash.ExpiryNotExtended.selector);
        leash.extend(id, expiry - 1);
        vm.prank(buyer);
        leash.extend(id, expiry + 1000);
        assertEq(leash.policyOf(id).expiry, expiry + 1000);
    }

    function test_extend_onlyBuyer() public {
        uint256 id = _create();
        vm.prank(makeAddr("notBuyer"));
        vm.expectRevert(Leash.NotBuyer.selector);
        leash.extend(id, expiry + 1000);
    }

    // ========== misc / invariants ==========

    function test_unknownPolicyReverts() public {
        vm.expectRevert(Leash.UnknownPolicy.selector);
        leash.policyOf(99);
    }

    function test_hashSpendAuth_matchesStruct() public {
        uint256 id = _create();
        Leash.SpendAuth memory a = _spendAuth(id, merchant, 1e6, keccak256("n1"), uint64(block.timestamp + 1 hours));
        bytes32 onchain = leash.hashSpendAuth(a);
        Signing.Spend memory s = Signing.Spend({policyId: a.policyId, agent: a.agent, vendor: a.vendor, amount: a.amount, purposeHash: a.purposeHash, nonce: a.nonce, expiresAt: a.expiresAt});
        bytes32 manual = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domainSeparator(),
                keccak256(abi.encode(Signing.SPEND_TYPEHASH, s.policyId, s.agent, s.vendor, s.amount, s.purposeHash, s.nonce, s.expiresAt))
            )
        );
        assertEq(onchain, manual);
    }

    function test_spentNeverExceedsBudget_fuzz(uint8 n) public {
        uint256 id = _create();
        uint256 spends = uint256(n) % 10 + 1;
        uint256 total;
        for (uint256 i = 0; i < spends; i++) {
            Leash.SpendAuth memory a = _spendAuth(id, merchant, CAP, keccak256(abi.encodePacked("fz", i)), uint64(block.timestamp + 1 hours));
            (uint8 v, bytes32 r, bytes32 s) = _sign(a);
            leash.spend(a, v, r, s);
            total += CAP;
        }
        assertLe(leash.policyOf(id).spent, BUDGET);
        assertEq(leash.policyOf(id).spent, total);
    }
}
