

◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
// Sources flattened with hardhat v2.28.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/interfaces/draft-IERC6093.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (interfaces/draft-IERC6093.sol)

pragma solidity >=0.8.4;

/**
 * @dev Standard ERC-20 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-20 tokens.
 */
interface IERC20Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC20InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC20InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `spender`’s `allowance`. Used in transfers.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     * @param allowance Amount of tokens a `spender` is allowed to operate with.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC20InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `spender` to be approved. Used in approvals.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC20InvalidSpender(address spender);
}

/**
 * @dev Standard ERC-721 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-721 tokens.
 */
interface IERC721Errors {
    /**
     * @dev Indicates that an address can't be an owner. For example, `address(0)` is a forbidden owner in ERC-721.
     * Used in balance queries.
     * @param owner Address of the current owner of a token.
     */
    error ERC721InvalidOwner(address owner);

    /**
     * @dev Indicates a `tokenId` whose `owner` is the zero address.
     * @param tokenId Identifier number of a token.
     */
    error ERC721NonexistentToken(uint256 tokenId);

    /**
     * @dev Indicates an error related to the ownership over a particular token. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param tokenId Identifier number of a token.
     * @param owner Address of the current owner of a token.
     */
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC721InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC721InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param tokenId Identifier number of a token.
     */
    error ERC721InsufficientApproval(address operator, uint256 tokenId);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC721InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC721InvalidOperator(address operator);
}

/**
 * @dev Standard ERC-1155 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-1155 tokens.
 */
interface IERC1155Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     * @param tokenId Identifier number of a token.
     */
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC1155InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC1155InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param owner Address of the current owner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address owner);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC1155InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC1155InvalidOperator(address operator);

    /**
     * @dev Indicates an array length mismatch between ids and values in a safeBatchTransferFrom operation.
     * Used in batch transfers.
     * @param idsLength Length of the array of token identifiers
     * @param valuesLength Length of the array of token amounts
     */
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}


// File @openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/extensions/IERC20Metadata.sol)

pragma solidity >=0.6.2;

/**
 * @dev Interface for the optional metadata functions from the ERC-20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}


// File @openzeppelin/contracts/token/ERC20/ERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.20;




/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.openzeppelin.com/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * The default value of {decimals} is 18. To change this, you should override
 * this function so it returns a different value.
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC-20
 * applications.
 */
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;

    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * Both values are immutable: they can only be set once during construction.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /// @inheritdoc IERC20
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /// @inheritdoc IERC20
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /// @inheritdoc IERC20
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Skips emitting an {Approval} event indicating an allowance update. This is not
     * required by the ERC. See {xref-ERC20-_approve-address-address-uint256-bool-}[_approve].
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, lowering the total supply.
     * Relies on the `_update` mechanism.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead
     */
    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over the `owner`'s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     *
     * Overrides to this logic should be done to the variant with an additional `bool emitEvent` argument.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    /**
     * @dev Variant of {_approve} with an optional flag to enable or disable the {Approval} event.
     *
     * By default (when calling {_approve}) the flag is set to true. On the other hand, approval changes made by
     * `_spendAllowance` during the `transferFrom` operation sets the flag to false. This saves gas by not emitting any
     * `Approval` event during `transferFrom` operations.
     *
     * Anyone who wishes to continue emitting `Approval` events on the `transferFrom` operation can force the flag to
     * true using the following override:
     *
     * ```solidity
     * function _approve(address owner, address spender, uint256 value, bool) internal virtual override {
     *     super._approve(owner, spender, value, true);
     * }
     * ```
     *
     * Requirements are the same as {_approve}.
     */
    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    /**
     * @dev Updates `owner`'s allowance for `spender` based on spent `value`.
     *
     * Does not update the allowance value in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Does not emit an {Approval} event.
     */
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}


// File @openzeppelin/contracts/utils/StorageSlot.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}


// File contracts/interfaces/IUniswapV2Router02.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV2Router02 {
    function WETH() external pure returns (address);

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);

    function factory() external pure returns (address);
}


// File contracts/FatDeflationary.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;





/**
 * @title FatDeflationary
 * @dev ERC-20 deflationary token — same battle-tested tax architecture as FatTax,
 *      with a permanent burn component. Every `deflationPercent` slice of collected tax
 *      is burned via ERC20 `_burn`, permanently reducing `totalSupply`.
 *
 * Features:
 * - Separate tax rates for Transfers, Buys, and Sells
 * - Flexible tax distribution: marketing, liquidity, team, buyback, BURN (deflationary)
 * - AUTO-SWAP: Tax tokens automatically swapped to ETH via DEX Router
 * - AUTO-LIQUIDITY: Liquidity portion auto-added to DEX (LP tokens to owner)
 * - DEX pair management for buy/sell detection
 * - Comprehensive exemption system
 * - `totalBurned()` view tracks cumulative supply destroyed
 */
contract FatDeflationary is ERC20, Ownable, ReentrancyGuard {

    // ============================================
    // STRUCTS
    // ============================================

    struct TaxBehavior {
        bool taxOnTransfer;     // Apply tax on wallet-to-wallet transfers
        bool taxOnBuy;          // Apply tax when buying from DEX
        bool taxOnSell;         // Apply tax when selling to DEX
        uint256 transferTax;    // Tax rate for transfers (basis points, e.g., 200 = 2%)
        uint256 buyTax;         // Tax rate for buys (basis points)
        uint256 sellTax;        // Tax rate for sells (basis points)
    }

    struct TaxDistribution {
        uint256 marketingPercent;   // % of tax to marketing (0-10000) → ETH
        uint256 liquidityPercent;   // % of tax to auto-liquidity (0-10000) → Auto-add to DEX
        uint256 teamPercent;        // % of tax to team (0-10000) → ETH
        uint256 buybackPercent;     // % of tax to buyback (0-10000) → ETH
        uint256 deflationPercent;   // % of tax to burn (0-10000) → Burned as tokens
        // These MUST add up to 10000 (100% of collected tax)

        address marketingWallet;    // Receives ETH (address(0) if not used)
        address teamWallet;         // Receives ETH (address(0) if not used)
        address buybackWallet;      // Receives ETH (address(0) if not used)
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    string private _tokenName;
    string private _tokenSymbol;
    uint8 private _decimals;

    TaxBehavior public taxBehavior;
    TaxDistribution public taxDistribution;

    mapping(address => bool) public isExempt;
    mapping(address => bool) public isDexPair;

    address[] private _dexPairs;

    IUniswapV2Router02 public dexRouter;
    uint256 public swapTokensAtAmount;
    bool private _inSwap;
    bool public autoSwapEnabled;

    bool private _initialized;

    uint256 public slippageTolerance = 500;
    uint256 public swapDeadline = 300;

    uint256 public constant MAX_TAX = 2500;
    uint256 public constant MAX_SLIPPAGE = 1000;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_SWAP_MULTIPLIER = 20;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 private _totalBurned;

    // ============================================
    // EVENTS
    // ============================================

    event TaxCollected(address indexed from, string transferType, uint256 totalTax, uint256 tokensToContract);
    event SwapAndDistribute(uint256 tokensSwapped, uint256 ethReceived, uint256 ethToMarketing, uint256 ethToTeam, uint256 ethToBuyback);
    event LiquidityAdded(uint256 tokensAdded, uint256 ethAdded, uint256 liquidity);
    event ExemptStatusChanged(address indexed account, bool status);
    event DexPairUpdated(address indexed pair, bool status);
    event TaxBehaviorUpdated(TaxBehavior newBehavior);
    event TaxDistributionUpdated(TaxDistribution newDistribution);
    event RouterUpdated(address indexed newRouter);
    event SwapThresholdUpdated(uint256 newThreshold);
    event AutoSwapEnabledUpdated(bool enabled);
    event SlippageToleranceUpdated(uint256 newTolerance);
    event SwapDeadlineUpdated(uint256 newDeadline);
    event DistributionFailed(string wallet, uint256 amount);
    event ETHRecovered(uint256 amount);
    event ERC20Recovered(address indexed token, uint256 amount);
    event MEVProtectionUpdated(bool enabled);
    event Deflated(uint256 amount, uint256 totalBurnedAfter);
    event TransferFailed(address indexed from, address indexed to, uint256 amount, string reason);
    event OwnershipRenounced(address indexed previousOwner, uint256 timestamp);

    // ============================================
    // ERRORS
    // ============================================

    error AlreadyInitialized();
    error TaxTooHigh(uint256 provided, uint256 max);
    error InvalidTaxWallet(string walletType);
    error InvalidDistribution(uint256 total, uint256 expected);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor() ERC20("Implementation", "IMPL") Ownable(msg.sender) {
        // (removed: was clone guard)
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        address owner_,
        TaxBehavior memory taxBehavior_,
        TaxDistribution memory taxDistribution_,
        address dexRouter_
    ) external {
        if (_initialized) revert AlreadyInitialized();

        if (taxBehavior_.transferTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.transferTax, MAX_TAX);
        if (taxBehavior_.buyTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.buyTax, MAX_TAX);
        if (taxBehavior_.sellTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.sellTax, MAX_TAX);

        uint256 totalDistribution = taxDistribution_.marketingPercent +
                                     taxDistribution_.liquidityPercent +
                                     taxDistribution_.teamPercent +
                                     taxDistribution_.buybackPercent +
                                     taxDistribution_.deflationPercent;

        if (totalDistribution != BASIS_POINTS) {
            revert InvalidDistribution(totalDistribution, BASIS_POINTS);
        }

        if (taxDistribution_.marketingPercent > 0 && taxDistribution_.marketingWallet == address(0)) {
            revert InvalidTaxWallet("marketing");
        }
        if (taxDistribution_.teamPercent > 0 && taxDistribution_.teamWallet == address(0)) {
            revert InvalidTaxWallet("team");
        }
        if (taxDistribution_.buybackPercent > 0 && taxDistribution_.buybackWallet == address(0)) {
            revert InvalidTaxWallet("buyback");
        }

        _setName(name_);
        _setSymbol(symbol_);

        _decimals = decimals_;
        taxBehavior = taxBehavior_;
        taxDistribution = taxDistribution_;

        dexRouter = IUniswapV2Router02(dexRouter_);
        swapTokensAtAmount = totalSupply_ / 20000;
        autoSwapEnabled = true;

        slippageTolerance = 500;
        swapDeadline = 300;

        _transferOwnership(owner_);

        if (totalSupply_ > 0) {
            _mint(owner_, totalSupply_);
        }

        isExempt[owner_] = true;
        isExempt[address(this)] = true;
        if (taxDistribution_.marketingWallet != address(0)) isExempt[taxDistribution_.marketingWallet] = true;
        if (taxDistribution_.teamWallet != address(0)) isExempt[taxDistribution_.teamWallet] = true;
        if (taxDistribution_.buybackWallet != address(0)) isExempt[taxDistribution_.buybackWallet] = true;
        isExempt[DEAD_ADDRESS] = true;

        _initialized = true;
    }

    // ============================================
    // INTERNAL STORAGE SETTERS
    // ============================================

    function name() public view override returns (string memory) { return _tokenName; }
    function symbol() public view override returns (string memory) { return _tokenSymbol; }
    function _setName(string memory name_) private { _tokenName = name_; }
    function _setSymbol(string memory symbol_) private { _tokenSymbol = symbol_; }

    // ============================================
    // ERC20 OVERRIDES
    // ============================================

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function _update(address from, address to, uint256 amount) internal virtual override(ERC20) {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        if (isExempt[from] || isExempt[to]) {
            super._update(from, to, amount);
            return;
        }

        (bool shouldTax, uint256 taxRate, string memory transferType) = _getTaxInfo(from, to);

        uint256 taxAmount = 0;
        uint256 amountAfterTax = amount;

        if (shouldTax && taxRate > 0) {
            taxAmount = (amount * taxRate) / BASIS_POINTS;
            amountAfterTax = amount - taxAmount;
        }

        if (taxAmount > 0) {
            _distributeTax(from, taxAmount, transferType);
        }

        super._update(from, to, amountAfterTax);
    }

    // ============================================
    // TAX LOGIC
    // ============================================

    function _getTaxInfo(address from, address to)
        private view
        returns (bool shouldTax, uint256 taxRate, string memory transferType)
    {
        bool isBuy = isDexPair[from] && !isDexPair[to];
        bool isSell = !isDexPair[from] && isDexPair[to];
        bool isTransfer = !isDexPair[from] && !isDexPair[to];

        if (isBuy) {
            transferType = "BUY"; shouldTax = taxBehavior.taxOnBuy; taxRate = taxBehavior.buyTax;
        } else if (isSell) {
            transferType = "SELL"; shouldTax = taxBehavior.taxOnSell; taxRate = taxBehavior.sellTax;
        } else if (isTransfer) {
            transferType = "TRANSFER"; shouldTax = taxBehavior.taxOnTransfer; taxRate = taxBehavior.transferTax;
        } else {
            transferType = "DEX_TO_DEX"; shouldTax = false; taxRate = 0;
        }
    }

    function _distributeTax(address from, uint256 totalTax, string memory transferType) private {
        super._update(from, address(this), totalTax);
        emit TaxCollected(from, transferType, totalTax, totalTax);

        if (autoSwapEnabled) {
            uint256 contractBalance = balanceOf(address(this));
            bool canSwap = contractBalance >= swapTokensAtAmount;

            if (canSwap && !_inSwap && !isDexPair[from]) {
                uint256 maxSwap = swapTokensAtAmount * MAX_SWAP_MULTIPLIER;
                uint256 swapAmount = contractBalance > maxSwap ? maxSwap : contractBalance;
                try this.autoSwapEntry(swapAmount) {} catch {}
            }
        }
    }

    function autoSwapEntry(uint256 amount) external {
        require(msg.sender == address(this), "Only self");
        _swapAndDistribute(amount);
    }

    // ============================================
    // SWAP & LIQUIDITY FUNCTIONS
    // ============================================

    modifier lockTheSwap {
        _inSwap = true;
        _;
        _inSwap = false;
    }

    function _swapTokensForEth(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = dexRouter.WETH();
        _approve(address(this), address(dexRouter), tokenAmount);
        dexRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount, 0, path, address(this), block.timestamp + swapDeadline
        );
    }

    function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        address lpRecipient = owner();
        if (lpRecipient == address(0)) lpRecipient = 0x000000000000000000000000000000000000dEaD;
        _approve(address(this), address(dexRouter), tokenAmount);
        dexRouter.addLiquidityETH{value: ethAmount}(address(this), tokenAmount, 0, 0, lpRecipient, block.timestamp + swapDeadline);
        emit LiquidityAdded(tokenAmount, ethAmount, 0);
    }

    function _swapAndDistribute(uint256 taxAmount) private lockTheSwap {
        uint256 burnAmount = (taxAmount * taxDistribution.deflationPercent) / BASIS_POINTS;
        uint256 liquidityTokens = (taxAmount * taxDistribution.liquidityPercent) / BASIS_POINTS;
        uint256 swapTokens = taxAmount - burnAmount - liquidityTokens;

        if (burnAmount > 0) {
            super._update(address(this), DEAD_ADDRESS, burnAmount);
            emit Transfer(address(this), DEAD_ADDRESS, burnAmount);
            _totalBurned += burnAmount;
            emit Deflated(burnAmount, _totalBurned);
        }

        if (liquidityTokens > 0) {
            uint256 half = liquidityTokens / 2;
            uint256 otherHalf = liquidityTokens - half;
            uint256 initialBalance = address(this).balance;
            _swapTokensForEth(half);
            _addLiquidity(otherHalf, address(this).balance - initialBalance);
        }

        if (swapTokens > 0) {
            uint256 initialBalance = address(this).balance;
            _swapTokensForEth(swapTokens);
            uint256 ethForDistribution = address(this).balance - initialBalance;

            uint256 totalDistPercent = taxDistribution.marketingPercent + taxDistribution.teamPercent + taxDistribution.buybackPercent;
            uint256 ethToMarketing = 0; uint256 ethToTeam = 0; uint256 ethToBuyback = 0;

            if (totalDistPercent > 0) {
                ethToMarketing = (ethForDistribution * taxDistribution.marketingPercent) / totalDistPercent;
                ethToTeam = (ethForDistribution * taxDistribution.teamPercent) / totalDistPercent;
                ethToBuyback = ethForDistribution - ethToMarketing - ethToTeam;
            }

            if (ethToMarketing > 0) { (bool s,) = taxDistribution.marketingWallet.call{value: ethToMarketing}(""); if (!s) emit DistributionFailed("marketing", ethToMarketing); }
            if (ethToTeam > 0) { (bool s,) = taxDistribution.teamWallet.call{value: ethToTeam}(""); if (!s) emit DistributionFailed("team", ethToTeam); }
            if (ethToBuyback > 0) { (bool s,) = taxDistribution.buybackWallet.call{value: ethToBuyback}(""); if (!s) emit DistributionFailed("buyback", ethToBuyback); }

            emit SwapAndDistribute(swapTokens, ethForDistribution, ethToMarketing, ethToTeam, ethToBuyback);
        }
    }

    receive() external payable {}

    function recoverETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to recover");
        (bool success,) = owner().call{value: balance}("");
        require(success, "ETH recovery failed");
        emit ETHRecovered(balance);
    }

    function recoverERC20(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(this), "Cannot recover own tokens");
        require(amount > 0, "Amount must be > 0");
        IERC20(tokenAddress).transfer(owner(), amount);
        emit ERC20Recovered(tokenAddress, amount);
    }

    function manualSwap() external onlyOwner nonReentrant {
        uint256 contractBalance = balanceOf(address(this));
        require(contractBalance > 0, "No tokens to swap");
        _swapAndDistribute(contractBalance);
    }

    function manualSwapAmount(uint256 amount) external onlyOwner nonReentrant {
        uint256 contractBalance = balanceOf(address(this));
        require(amount > 0 && amount <= contractBalance, "Invalid amount");
        _swapAndDistribute(amount);
    }

    // ============================================
    // OWNER FUNCTIONS
    // ============================================

    function setExempt(address account, bool status) external onlyOwner { isExempt[account] = status; emit ExemptStatusChanged(account, status); }

    function setExemptBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) { isExempt[accounts[i]] = status; emit ExemptStatusChanged(accounts[i], status); }
    }

    function setDexPair(address pair, bool status) public onlyOwner {
        if (status && !isDexPair[pair]) { _dexPairs.push(pair); }
        else if (!status && isDexPair[pair]) {
            for (uint256 i = 0; i < _dexPairs.length; i++) {
                if (_dexPairs[i] == pair) { _dexPairs[i] = _dexPairs[_dexPairs.length - 1]; _dexPairs.pop(); break; }
            }
        }
        isDexPair[pair] = status;
        emit DexPairUpdated(pair, status);
    }

    function setDexPairBatch(address[] calldata pairs, bool status) external onlyOwner {
        for (uint256 i = 0; i < pairs.length; i++) { setDexPair(pairs[i], status); }
    }

    function updateTaxBehavior(TaxBehavior memory newBehavior) external onlyOwner {
        if (newBehavior.transferTax > MAX_TAX) revert TaxTooHigh(newBehavior.transferTax, MAX_TAX);
        if (newBehavior.buyTax > MAX_TAX) revert TaxTooHigh(newBehavior.buyTax, MAX_TAX);
        if (newBehavior.sellTax > MAX_TAX) revert TaxTooHigh(newBehavior.sellTax, MAX_TAX);
        taxBehavior = newBehavior;
        emit TaxBehaviorUpdated(newBehavior);
    }

    function updateTaxDistribution(TaxDistribution memory newDistribution) external onlyOwner {
        uint256 totalDistribution = newDistribution.marketingPercent + newDistribution.liquidityPercent +
                                     newDistribution.teamPercent + newDistribution.buybackPercent + newDistribution.deflationPercent;
        if (totalDistribution != BASIS_POINTS) revert InvalidDistribution(totalDistribution, BASIS_POINTS);
        if (newDistribution.marketingPercent > 0 && newDistribution.marketingWallet == address(0)) revert InvalidTaxWallet("marketing");
        if (newDistribution.teamPercent > 0 && newDistribution.teamWallet == address(0)) revert InvalidTaxWallet("team");
        if (newDistribution.buybackPercent > 0 && newDistribution.buybackWallet == address(0)) revert InvalidTaxWallet("buyback");

        if (taxDistribution.marketingWallet != address(0)) isExempt[taxDistribution.marketingWallet] = false;
        if (taxDistribution.teamWallet != address(0)) isExempt[taxDistribution.teamWallet] = false;
        if (taxDistribution.buybackWallet != address(0)) isExempt[taxDistribution.buybackWallet] = false;

        taxDistribution = newDistribution;

        if (newDistribution.marketingWallet != address(0)) isExempt[newDistribution.marketingWallet] = true;
        if (newDistribution.teamWallet != address(0)) isExempt[newDistribution.teamWallet] = true;
        if (newDistribution.buybackWallet != address(0)) isExempt[newDistribution.buybackWallet] = true;

        emit TaxDistributionUpdated(newDistribution);
    }

    function setDexRouter(address newRouter) external onlyOwner { require(newRouter != address(0), "Invalid router"); dexRouter = IUniswapV2Router02(newRouter); emit RouterUpdated(newRouter); }
    function setSwapThreshold(uint256 newThreshold) external onlyOwner { require(newThreshold > 0, "Threshold must be > 0"); require(newThreshold <= totalSupply() / 50, "Threshold too high"); swapTokensAtAmount = newThreshold; emit SwapThresholdUpdated(newThreshold); }
    function setSlippageTolerance(uint256 newTolerance) external onlyOwner { require(newTolerance <= MAX_SLIPPAGE, "Slippage too high"); slippageTolerance = newTolerance; emit SlippageToleranceUpdated(newTolerance); }
    function setSwapDeadline(uint256 newDeadline) external onlyOwner { require(newDeadline >= 60 && newDeadline <= 3600, "Deadline must be 1-60 minutes"); swapDeadline = newDeadline; emit SwapDeadlineUpdated(newDeadline); }
    function setAutoSwapEnabled(bool enabled) external onlyOwner { autoSwapEnabled = enabled; emit AutoSwapEnabledUpdated(enabled); }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function isInitialized() external view returns (bool) { return _initialized; }
    function getTaxBehavior() external view returns (TaxBehavior memory) { return taxBehavior; }
    function getTaxDistribution() external view returns (TaxDistribution memory) { return taxDistribution; }

    function calculateTax(address from, address to, uint256 amount)
        external view returns (uint256 taxAmount, uint256 netAmount, string memory transferType)
    {
        if (from == address(0) || to == address(0)) return (0, amount, "MINT_OR_BURN");
        if (isExempt[from] || isExempt[to]) return (0, amount, "EXEMPT");
        (bool shouldTax, uint256 taxRate, string memory txType) = _getTaxInfo(from, to);
        if (!shouldTax || taxRate == 0) return (0, amount, txType);
        taxAmount = (amount * taxRate) / BASIS_POINTS;
        netAmount = amount - taxAmount;
        transferType = txType;
    }

    function previewTaxDistribution(address from, address to, uint256 amount)
        external view
        returns (uint256 toRecipient, uint256 toMarketing, uint256 toLiquidity, uint256 toTeam, uint256 toBuyback, uint256 toBurn)
    {
        (uint256 totalTax, uint256 afterTax,) = this.calculateTax(from, to, amount);
        toRecipient = afterTax;
        if (totalTax > 0) {
            toMarketing = (totalTax * taxDistribution.marketingPercent) / BASIS_POINTS;
            toLiquidity = (totalTax * taxDistribution.liquidityPercent) / BASIS_POINTS;
            toTeam = (totalTax * taxDistribution.teamPercent) / BASIS_POINTS;
            toBuyback = (totalTax * taxDistribution.buybackPercent) / BASIS_POINTS;
            toBurn = (totalTax * taxDistribution.deflationPercent) / BASIS_POINTS;
        }
    }

    function canTransfer(address from, address /*to*/, uint256 amount) external view returns (bool success, string memory reason) {
        if (balanceOf(from) < amount) return (false, "Insufficient balance");
        return (true, "");
    }

    function detectTransferType(address from, address to) external view returns (string memory transferType) {
        if (from == address(0)) return "MINT";
        if (to == address(0)) return "BURN";
        if (isDexPair[from] && !isDexPair[to]) return "BUY";
        if (!isDexPair[from] && isDexPair[to]) return "SELL";
        if (isDexPair[from] && isDexPair[to]) return "DEX_TO_DEX";
        return "TRANSFER";
    }

    function getTaxRateForTransfer(address from, address to) external view returns (uint256 taxRate) {
        (, uint256 rate,) = _getTaxInfo(from, to); return rate;
    }

    function getAllDexPairs() external view returns (address[] memory) { return _dexPairs; }
    function getDexPairCount() external view returns (uint256) { return _dexPairs.length; }
    function getMarketingWallet() external view returns (address) { return taxDistribution.marketingWallet; }
    function getTeamWallet() external view returns (address) { return taxDistribution.teamWallet; }
    function getBuybackWallet() external view returns (address) { return taxDistribution.buybackWallet; }
    function isTaxEnabled() external view returns (bool) { return taxBehavior.taxOnBuy || taxBehavior.taxOnSell || taxBehavior.taxOnTransfer; }

    function getMaxActiveTaxRate() external view returns (uint256) {
        uint256 maxRate = 0;
        if (taxBehavior.taxOnTransfer && taxBehavior.transferTax > maxRate) maxRate = taxBehavior.transferTax;
        if (taxBehavior.taxOnBuy && taxBehavior.buyTax > maxRate) maxRate = taxBehavior.buyTax;
        if (taxBehavior.taxOnSell && taxBehavior.sellTax > maxRate) maxRate = taxBehavior.sellTax;
        return maxRate;
    }

    function buyTax() external view returns (uint256) { return taxBehavior.buyTax; }
    function sellTax() external view returns (uint256) { return taxBehavior.sellTax; }
    function transferTax() external view returns (uint256) { return taxBehavior.transferTax; }

    // Deflationary-specific views
    function totalBurned() external view returns (uint256) { return _totalBurned; }

    function calculateBurn(address from, address to, uint256 amount) external view returns (uint256 burnAmount, uint256 netAmount) {
        (uint256 totalTax, uint256 afterTax,) = this.calculateTax(from, to, amount);
        burnAmount = (totalTax * taxDistribution.deflationPercent) / BASIS_POINTS;
        netAmount = afterTax;
    }

    function isDeflationEnabled() external view returns (bool) {
        return taxDistribution.deflationPercent > 0 &&
            (taxBehavior.taxOnBuy || taxBehavior.taxOnSell || taxBehavior.taxOnTransfer);
    }

    function getCirculatingSupply() external view returns (uint256) {
        return totalSupply() - balanceOf(address(this)) - balanceOf(0x000000000000000000000000000000000000dEaD);
    }

    function getBurnStatistics() external view returns (uint256 totalBurned_, uint256 burnPercentage, uint256 circulatingSupply) {
        totalBurned_ = _totalBurned;
        uint256 original = totalSupply();
        burnPercentage = original > 0 ? (_totalBurned * BASIS_POINTS) / original : 0;
        circulatingSupply = totalSupply() - balanceOf(address(this)) - balanceOf(0x000000000000000000000000000000000000dEaD);
    }

}
