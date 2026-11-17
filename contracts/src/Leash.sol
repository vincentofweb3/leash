// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Leash
/// @notice Onchain spend allowances for AI agents. A buyer sets a policy — per-transaction cap,
///         cumulative budget, optional rolling daily cap, optional vendor allowlist, expiry —
///         and hands a session-key address to the agent. The agent signs EIP-712 spend
///         authorizations; this contract verifies them and executes
///         `transferFrom(buyer, vendor, amount)` against the buyer's tUSD8 allowance.
/// @dev The contract never takes custody beyond the buyer's ERC-20 allowance. There is no owner,
///      admin, upgrade, pause or rescue path. Every spend is bound to one nonce and one purpose
///      hash; the buyer can kill a session key with `revoke` at any time.
contract Leash is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant MAX_ALLOWLIST = 16;
    bytes32 private constant SPEND_AUTH_TYPEHASH = keccak256(
        "SpendAuth(uint256 policyId,address agent,address vendor,uint256 amount,bytes32 purposeHash,bytes32 nonce,uint64 expiresAt)"
    );

    struct Policy {
        address buyer;
        address agent;
        uint256 perTxCap;
        uint256 budget;
        uint256 spent;
        uint64 expiry;
        uint64 dailyCap;
        uint256 daySpent;
        uint64 dayBucket;
        bool revoked;
        bytes32 labelHash;
    }

    struct SpendAuth {
        uint256 policyId;
        address agent;
        address vendor;
        uint256 amount;
        bytes32 purposeHash;
        bytes32 nonce;
        uint64 expiresAt;
    }

    IERC20 public immutable token;

    uint256 public nextPolicyId;
    mapping(uint256 policyId => Policy) public policies;
    mapping(uint256 policyId => mapping(bytes32 nonce => bool used)) public usedNonce;
    mapping(uint256 policyId => address[] vendors) private _allowlists;

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed buyer,
        address indexed agent,
        uint256 perTxCap,
        uint256 budget,
        uint64 dailyCap,
        uint64 expiry,
        bytes32 labelHash,
        uint256 allowlistSize
    );
    event PolicyRevoked(uint256 indexed policyId, address indexed buyer);
    event PolicyLimitsUpdated(uint256 indexed policyId, uint256 perTxCap, uint256 budget, uint64 dailyCap);
    event PolicyExpiryExtended(uint256 indexed policyId, uint64 expiry);
    event AllowlistUpdated(uint256 indexed policyId, uint256 size);
    event Spent(
        uint256 indexed policyId,
        address indexed vendor,
        uint256 amount,
        bytes32 purposeHash,
        bytes32 nonce,
        uint256 spentAfter
    );

    error ZeroAmount();
    error ZeroAddress();
    error BadPerTxCap();
    error BadBudget();
    error PolicyExpired();
    error SpendExpired();
    error Revoked();
    error NotBuyer();
    error BadSignature();
    error ExceedsPerTxCap();
    error ExceedsBudget();
    error ExceedsDailyCap();
    error VendorNotAllowed();
    error NonceUsed();
    error AllowanceTooSmall(uint256 remaining);
    error AllowlistTooLarge();
    error UnknownPolicy();
    error SpendAuthAgentMismatch();
    error ZeroVendor();
    error ExpiryNotExtended();

    constructor(IERC20 token_) EIP712("Leash", "1") {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
    }

    // ---------- policy lifecycle ----------

    /// @notice Create a policy for an agent session key. The buyer must approve this contract
    ///         for at least `budget` token units before the agent can spend.
    function createPolicy(
        address agent,
        uint256 perTxCap,
        uint256 budget,
        uint64 dailyCap,
        uint64 expiry,
        bytes32 labelHash,
        address[] calldata allowlist
    ) external returns (uint256 policyId) {
        if (agent == address(0)) revert ZeroAddress();
        if (budget == 0) revert BadBudget();
        if (perTxCap == 0 || perTxCap > budget) revert BadPerTxCap();
        if (expiry <= uint64(block.timestamp)) revert PolicyExpired();
        if (allowlist.length > MAX_ALLOWLIST) revert AllowlistTooLarge();

        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            buyer: msg.sender,
            agent: agent,
            perTxCap: perTxCap,
            budget: budget,
            spent: 0,
            expiry: expiry,
            dailyCap: dailyCap,
            daySpent: 0,
            dayBucket: uint64(block.timestamp / 1 days),
            revoked: false,
            labelHash: labelHash
        });
        for (uint256 i = 0; i < allowlist.length; i++) {
            if (allowlist[i] == address(0)) revert ZeroAddress();
            _allowlists[policyId].push(allowlist[i]);
        }
        emit PolicyCreated(policyId, msg.sender, agent, perTxCap, budget, dailyCap, expiry, labelHash, allowlist.length);
    }

    /// @notice Kill the session key. Unspent allowance simply stops moving.
    function revoke(uint256 policyId) external {
        Policy storage p = _policy(policyId);
        if (msg.sender != p.buyer) revert NotBuyer();
        p.revoked = true;
        emit PolicyRevoked(policyId, msg.sender);
    }

    /// @notice Raise or lower caps. Cannot lower `budget` below what is already spent.
    function setLimits(uint256 policyId, uint256 perTxCap, uint256 budget, uint64 dailyCap) external {
        Policy storage p = _policy(policyId);
        if (msg.sender != p.buyer) revert NotBuyer();
        if (budget < p.spent) revert BadBudget();
        if (perTxCap == 0 || perTxCap > budget) revert BadPerTxCap();
        p.perTxCap = perTxCap;
        p.budget = budget;
        p.dailyCap = dailyCap;
        emit PolicyLimitsUpdated(policyId, perTxCap, budget, dailyCap);
    }

    /// @notice Extend the policy expiry. Cannot shorten it.
    function extend(uint256 policyId, uint64 expiry) external {
        Policy storage p = _policy(policyId);
        if (msg.sender != p.buyer) revert NotBuyer();
        if (expiry <= p.expiry) revert ExpiryNotExtended();
        p.expiry = expiry;
        emit PolicyExpiryExtended(policyId, expiry);
    }

    /// @notice Replace the vendor allowlist (max 16). Empty array means "any vendor".
    function setAllowlist(uint256 policyId, address[] calldata allowlist) external {
        Policy storage p = _policy(policyId);
        if (msg.sender != p.buyer) revert NotBuyer();
        if (allowlist.length > MAX_ALLOWLIST) revert AllowlistTooLarge();
        delete _allowlists[policyId];
        for (uint256 i = 0; i < allowlist.length; i++) {
            if (allowlist[i] == address(0)) revert ZeroAddress();
            _allowlists[policyId].push(allowlist[i]);
        }
        emit AllowlistUpdated(policyId, allowlist.length);
    }

    // ---------- spending ----------

    /// @notice Execute a spend authorized by the agent session key. Callable by anyone
    ///         (the agent, a relayer, the merchant); only the agent's signature authorizes movement.
    function spend(SpendAuth calldata auth, uint8 v, bytes32 r, bytes32 s) external nonReentrant {
        Policy storage p = _policy(auth.policyId);
        if (p.revoked) revert Revoked();
        if (block.timestamp >= p.expiry) revert PolicyExpired();
        if (auth.expiresAt <= uint64(block.timestamp)) revert SpendExpired();
        if (auth.amount == 0) revert ZeroAmount();
        if (auth.agent != p.agent) revert SpendAuthAgentMismatch();
        if (auth.vendor == address(0)) revert ZeroVendor();
        if (usedNonce[auth.policyId][auth.nonce]) revert NonceUsed();
        if (auth.amount > p.perTxCap) revert ExceedsPerTxCap();
        if (auth.amount > p.budget - p.spent) revert ExceedsBudget();

        uint64 today = uint64(block.timestamp / 1 days);
        if (p.dayBucket != today) {
            p.dayBucket = today;
            p.daySpent = 0;
        }
        if (p.dailyCap != 0 && p.daySpent + auth.amount > p.dailyCap) revert ExceedsDailyCap();

        if (_allowlists[auth.policyId].length != 0 && !_isAllowed(auth.policyId, auth.vendor)) {
            revert VendorNotAllowed();
        }

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SPEND_AUTH_TYPEHASH,
                    auth.policyId,
                    auth.agent,
                    auth.vendor,
                    auth.amount,
                    auth.purposeHash,
                    auth.nonce,
                    auth.expiresAt
                )
            )
        );
        if (ECDSA.recover(digest, v, r, s) != p.agent) revert BadSignature();

        uint256 allowed = token.allowance(p.buyer, address(this));
        if (allowed < auth.amount) revert AllowanceTooSmall(allowed);

        usedNonce[auth.policyId][auth.nonce] = true;
        p.spent += auth.amount;
        p.daySpent += auth.amount;

        token.safeTransferFrom(p.buyer, auth.vendor, auth.amount);
        emit Spent(auth.policyId, auth.vendor, auth.amount, auth.purposeHash, auth.nonce, p.spent);
    }

    // ---------- views ----------

    function policyOf(uint256 policyId) external view returns (Policy memory) {
        return _policy(policyId);
    }

    function remainingBudget(uint256 policyId) external view returns (uint256) {
        Policy storage p = _policy(policyId);
        return p.budget - p.spent;
    }

    function todaySpent(uint256 policyId) external view returns (uint256) {
        Policy storage p = _policy(policyId);
        return p.dayBucket == uint64(block.timestamp / 1 days) ? p.daySpent : 0;
    }

    function allowlistOf(uint256 policyId) external view returns (address[] memory) {
        return _allowlists[policyId];
    }

    function hashSpendAuth(SpendAuth calldata auth) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SPEND_AUTH_TYPEHASH,
                    auth.policyId,
                    auth.agent,
                    auth.vendor,
                    auth.amount,
                    auth.purposeHash,
                    auth.nonce,
                    auth.expiresAt
                )
            )
        );
    }

    // ---------- internal ----------

    function _policy(uint256 policyId) internal view returns (Policy storage p) {
        if (policyId >= nextPolicyId) revert UnknownPolicy();
        p = policies[policyId];
    }

    function _isAllowed(uint256 policyId, address vendor) internal view returns (bool) {
        address[] storage list = _allowlists[policyId];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == vendor) return true;
        }
        return false;
    }
}
