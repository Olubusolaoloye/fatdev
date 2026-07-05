// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StandardTokenImplementation
 * @dev Clean ERC-20 token with optional features - NO automatic taxes, burns, or reflections
 *
 * This is a STANDARD token - transfers are 1:1 with no fees unless user enables optional features.
 *
 * Features:
 * - Standard ERC-20 transfers (1:1, no fees)
 * - NO pause functionality
 * - NO mint functionality
 * - NO max wallet limits
 * - NO max transaction limits
 * - NO blacklist
 * - Ownership can be renounced after deployment
 */
contract StandardTokenImplementation is ERC20, Ownable {

    // ============================================
    // STATE VARIABLES
    // ============================================

    // Token metadata (for clone support)
    string private _tokenName;
    string private _tokenSymbol;

    uint8 private _decimals;

    bool private _initialized;

    // ============================================
    // ERRORS
    // ============================================

    error AlreadyInitialized();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor() ERC20("Implementation", "IMPL") Ownable(msg.sender) {
        _initialized = true; // Prevent implementation from being initialized
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        address owner_
    ) external {
        if (_initialized) revert AlreadyInitialized();

        _setName(name_);
        _setSymbol(symbol_);

        _decimals = decimals_;

        _transferOwnership(owner_);

        if (totalSupply_ > 0) {
            _mint(owner_, totalSupply_);
        }

        _initialized = true;
    }

    // ============================================
    // INTERNAL STORAGE SETTERS
    // ============================================

    /// @notice Override name() to return the stored name (for clone support)
    function name() public view override returns (string memory) {
        return _tokenName;
    }

    /// @notice Override symbol() to return the stored symbol (for clone support)
    function symbol() public view override returns (string memory) {
        return _tokenSymbol;
    }

    function _setName(string memory name_) private {
        _tokenName = name_;
    }

    function _setSymbol(string memory symbol_) private {
        _tokenSymbol = symbol_;
    }

    // ============================================
    // ERC20 OVERRIDES
    // ============================================

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function isInitialized() external view returns (bool) {
        return _initialized;
    }
}
