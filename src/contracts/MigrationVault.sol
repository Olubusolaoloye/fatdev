// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IERC20M {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title MigrationVault
/// @notice Self-serve V1→V2 token migration vault.
///         Owner funds with V2 tokens; holders approve V1 then call swap() to
///         receive V2 instantly at the configured ratio. No server required.
contract MigrationVault {
    address public owner;
    IERC20M public immutable v1Token;
    IERC20M public immutable v2Token;

    /// ratio: 1 V1 → (ratioNumerator / ratioDenominator) V2
    /// e.g. 1:1 → num=1, den=1   ;   100:1 rebase → num=1, den=100
    uint256 public immutable ratioNumerator;
    uint256 public immutable ratioDenominator;

    uint256 public windowEnd;
    uint256 public supplyCap;   // 0 = unlimited

    bool public paused;
    bool public stopped;

    uint256 public totalDeposited;
    uint256 public totalDisbursed;
    uint256 public participantCount;

    address public relayer; // optional oracle/relayer for manual disburse()

    mapping(address => bool)    private _hasParticipated;
    mapping(address => uint256) public  swappedByHolder;

    // ── Events ───────────────────────────────────────────────────────────────

    event Deposited(address indexed sender, uint256 amount);
    event Swapped(address indexed holder, uint256 v1Amount, uint256 v2Amount);
    event Disbursed(address indexed to, uint256 amount);
    event Paused();
    event Unpaused();
    event EmergencyStopped();
    event WindowExtended(uint256 newWindowEnd);
    event OwnershipTransferred(address indexed from, address indexed to);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == relayer, "not authorized");
        _;
    }

    modifier live() {
        require(!stopped,                      "vault stopped");
        require(!paused,                       "vault paused");
        require(block.timestamp <= windowEnd,  "window closed");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _v1Token,
        address _v2Token,
        uint256 _ratioNumerator,
        uint256 _ratioDenominator,
        uint256 _windowSeconds,
        uint256 _supplyCap
    ) {
        require(_v1Token     != address(0), "v1: zero addr");
        require(_v2Token     != address(0), "v2: zero addr");
        require(_ratioNumerator   > 0,      "ratio num zero");
        require(_ratioDenominator > 0,      "ratio den zero");
        require(_windowSeconds    > 0,      "window zero");

        owner             = msg.sender;
        relayer           = msg.sender;
        v1Token           = IERC20M(_v1Token);
        v2Token           = IERC20M(_v2Token);
        ratioNumerator    = _ratioNumerator;
        ratioDenominator  = _ratioDenominator;
        windowEnd         = block.timestamp + _windowSeconds;
        supplyCap         = _supplyCap;
    }

    // ── Owner: fund vault ────────────────────────────────────────────────────

    /// @notice Deposit V2 tokens into the vault. Caller must approve() first.
    function deposit(uint256 amount) external onlyOwner {
        require(!stopped, "vault stopped");
        require(amount > 0, "zero amount");
        require(v2Token.transferFrom(msg.sender, address(this), amount), "deposit failed");
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    // ── Holder: swap V1 for V2 (atomic, no oracle needed) ───────────────────

    /// @notice Swap V1 tokens for V2. Caller must approve() V1 first.
    function swap(uint256 v1Amount) external live {
        require(v1Amount > 0, "zero amount");

        uint256 v2Amount = (v1Amount * ratioNumerator) / ratioDenominator;
        require(v2Amount > 0, "ratio rounds to zero");

        if (supplyCap > 0) {
            require(totalDisbursed + v2Amount <= supplyCap, "supply cap exceeded");
        }
        require(vaultBalance() >= v2Amount, "vault underfunded");

        require(
            v1Token.transferFrom(msg.sender, address(this), v1Amount),
            "V1 transfer failed: approve vault first"
        );
        require(v2Token.transfer(msg.sender, v2Amount), "V2 transfer failed");

        if (!_hasParticipated[msg.sender]) {
            _hasParticipated[msg.sender] = true;
            participantCount++;
        }
        swappedByHolder[msg.sender] += v1Amount;
        totalDisbursed += v2Amount;

        emit Swapped(msg.sender, v1Amount, v2Amount);
    }

    // ── Owner/relayer: manual disburse ───────────────────────────────────────

    /// @notice Manually send V2 to a recipient (for retry / oracle flow).
    function disburse(address to, uint256 amount) external onlyAuthorized {
        require(!stopped, "vault stopped");
        require(to != address(0), "zero addr");
        require(amount > 0,       "zero amount");
        require(vaultBalance() >= amount, "insufficient balance");
        require(v2Token.transfer(to, amount), "transfer failed");
        totalDisbursed += amount;
        emit Disbursed(to, amount);
    }

    // ── Owner: controls ──────────────────────────────────────────────────────

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function emergencyStop() external onlyOwner {
        stopped = true;
        emit EmergencyStopped();
    }

    /// @param extraSeconds seconds to add to current windowEnd
    function extendWindow(uint256 extraSeconds) external onlyOwner {
        require(!stopped, "vault stopped");
        require(extraSeconds > 0, "zero");
        windowEnd += extraSeconds;
        emit WindowExtended(windowEnd);
    }

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero addr");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Pull remaining V2 tokens back after window closes or emergency stop.
    function withdrawRemaining() external onlyOwner {
        require(block.timestamp > windowEnd || stopped, "window still open");
        uint256 bal = vaultBalance();
        require(bal > 0, "nothing to withdraw");
        require(v2Token.transfer(owner, bal), "withdraw failed");
    }

    /// @notice Pull accumulated V1 tokens (deposited by holders during swap).
    function withdrawV1() external onlyOwner {
        uint256 bal = v1Token.balanceOf(address(this));
        require(bal > 0, "no V1 tokens");
        require(v1Token.transfer(owner, bal), "withdraw failed");
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function vaultBalance() public view returns (uint256) {
        return v2Token.balanceOf(address(this));
    }

    function isWindowOpen() public view returns (bool) {
        return !stopped && !paused && block.timestamp <= windowEnd;
    }

    function secondsRemaining() public view returns (uint256) {
        if (block.timestamp >= windowEnd) return 0;
        return windowEnd - block.timestamp;
    }

    function hasParticipated(address holder) external view returns (bool) {
        return _hasParticipated[holder];
    }
}
