// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";

/**
 * @title TaxTokenImplementation
 * @dev ERC-20 token with highly configurable transfer tax system
 *
 * Features:
 * - Separate tax rates for Transfers, Buys, and Sells
 * - Flexible tax distribution to multiple destinations (marketing, liquidity, team, buyback, burn)
 * - AUTO-SWAP: Tax tokens automatically swapped to ETH via DEX Router
 * - AUTO-LIQUIDITY: Liquidity portion auto-added to DEX (LP tokens to owner)
 * - Builder chooses ANY combination of tax destinations
 * - DEX pair management for buy/sell detection
 * - Comprehensive exemption system
 *
 * Builder Freedom:
 * - Choose which transfer types to tax (transfers, buys, sells, or any combination)
 * - Set different tax rates for each type (e.g., 2% transfer, 5% buy, 10% sell)
 * - Choose 1-5 tax destinations or any combination
 * - Receive tax in ETH (not tokens) - professional and clean
 */
contract TaxTokenImplementation is ERC20, Ownable, ReentrancyGuard {

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
        uint256 burnPercent;        // % of tax to burn (0-10000) → Burned as tokens
        // These MUST add up to 10000 (100% of collected tax)

        address marketingWallet;    // Receives ETH (address(0) if not used)
        address teamWallet;         // Receives ETH (address(0) if not used)
        address buybackWallet;      // Receives ETH (address(0) if not used)
        // No liquidityWallet - auto-liquidity handled by contract, LP tokens to owner
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    // Token metadata (for clone support)
    string private _tokenName;
    string private _tokenSymbol;
    uint8 private _decimals;

    TaxBehavior public taxBehavior;
    TaxDistribution public taxDistribution;

    mapping(address => bool) public isExempt;       // Exempt from tax and limits
    mapping(address => bool) public isDexPair;      // DEX pairs for buy/sell detection

    address[] private _dexPairs;                    // Array to track all DEX pairs

    IUniswapV2Router02 public dexRouter;            // DEX router for swaps
    uint256 public swapTokensAtAmount;              // Threshold to trigger swap
    bool private _inSwap;                           // Prevent recursion during swaps
    bool public autoSwapEnabled;                    // Enable/disable automatic swaps

    bool private _initialized;

    uint256 public slippageTolerance = 500;         // 5% default slippage tolerance (500/10000)
    uint256 public swapDeadline = 300;              // 5 minutes default deadline

    uint256 public constant MAX_TAX = 2500;         // 25% max tax per transaction
    uint256 public constant MAX_SLIPPAGE = 1000;    // 10% max slippage tolerance
    uint256 public constant BASIS_POINTS = 10000;   // 100%
    uint256 public constant MAX_SWAP_MULTIPLIER = 20;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ============================================
    // EVENTS
    // ============================================

    event TaxCollected(
        address indexed from,
        string transferType,
        uint256 totalTax,
        uint256 tokensToContract
    );
    event SwapAndDistribute(
        uint256 tokensSwapped,
        uint256 ethReceived,
        uint256 ethToMarketing,
        uint256 ethToTeam,
        uint256 ethToBuyback
    );
    event LiquidityAdded(
        uint256 tokensAdded,
        uint256 ethAdded,
        uint256 liquidity
    );
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

    /**
    * @dev Emitted when a transfer is attempted but fails due to max wallet or transaction limits.
    * Provides detailed information for debugging and user feedback.
    */
    event TransferFailed(
        address indexed from,
        address indexed to,
        uint256 amount,
        string reason
    );

    /**
    * @dev Emitted when the owner renounces ownership, permanently disabling owner-only functions.
    * Provides transparency and assurance to the community that the contract is now fully decentralized.
    */
    event OwnershipRenounced(address indexed previousOwner, uint256 timestamp);

    // ============================================
    // MODIFIERS
    // ============================================

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
        _initialized = true;
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

        // Validate tax rates
        if (taxBehavior_.transferTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.transferTax, MAX_TAX);
        if (taxBehavior_.buyTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.buyTax, MAX_TAX);
        if (taxBehavior_.sellTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.sellTax, MAX_TAX);

        // Validate tax distribution adds up to 100%
        uint256 totalDistribution = taxDistribution_.marketingPercent +
                                     taxDistribution_.liquidityPercent +
                                     taxDistribution_.teamPercent +
                                     taxDistribution_.buybackPercent +
                                     taxDistribution_.burnPercent;

        if (totalDistribution != BASIS_POINTS) {
            revert InvalidDistribution(totalDistribution, BASIS_POINTS);
        }

        // Validate wallets are set if their percentages > 0
        if (taxDistribution_.marketingPercent > 0 && taxDistribution_.marketingWallet == address(0)) {
            revert InvalidTaxWallet("marketing");
        }
        if (taxDistribution_.teamPercent > 0 && taxDistribution_.teamWallet == address(0)) {
            revert InvalidTaxWallet("team");
        }
        if (taxDistribution_.buybackPercent > 0 && taxDistribution_.buybackWallet == address(0)) {
            revert InvalidTaxWallet("buyback");
        }
        // No liquidity wallet needed - auto-liquidity handled by contract

        _setName(name_);
        _setSymbol(symbol_);

        _decimals = decimals_;
        taxBehavior = taxBehavior_;
        taxDistribution = taxDistribution_;

        // Initialize router and swap threshold
        dexRouter = IUniswapV2Router02(dexRouter_);
        swapTokensAtAmount = totalSupply_ / 20000; // 0.005% of supply — small, frequent, low price impact
        autoSwapEnabled = true; // Auto-swap enabled by default (can be disabled)

        // Initialize slippage protection defaults
        slippageTolerance = 500;  // 5% default
        swapDeadline = 300;       // 5 minutes default

        _transferOwnership(owner_);

        if (totalSupply_ > 0) {
            _mint(owner_, totalSupply_);
        }

        // Set exemptions - owner, contract, and all active tax wallets
        isExempt[owner_] = true;
        isExempt[address(this)] = true; // Contract exempt to allow swaps
        if (taxDistribution_.marketingWallet != address(0)) isExempt[taxDistribution_.marketingWallet] = true;
        if (taxDistribution_.teamWallet != address(0)) isExempt[taxDistribution_.teamWallet] = true;
        if (taxDistribution_.buybackWallet != address(0)) isExempt[taxDistribution_.buybackWallet] = true;
        isExempt[DEAD_ADDRESS] = true; // Dead address exempt — receives burn transfers, must not be taxed
        
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

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20) {
        // Skip tax/limits for mint/burn
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        // Skip tax if either party is exempt
        if (isExempt[from] || isExempt[to]) {
            super._update(from, to, amount);
            return;
        }

        // Determine if we should apply tax and get the tax rate
        (bool shouldTax, uint256 taxRate, string memory transferType) = _getTaxInfo(from, to);

        uint256 taxAmount = 0;
        uint256 amountAfterTax = amount;

        if (shouldTax && taxRate > 0) {
            taxAmount = (amount * taxRate) / BASIS_POINTS;
            amountAfterTax = amount - taxAmount;
        }

        // Distribute tax FIRST (and run any auto-swap) BEFORE forwarding tokens to recipient.
        // Ordering is load-bearing: if `to` is the DEX pair (sell/transfer-to-pair), moving the
        // user's `amountAfterTax` into the pair *before* auto-swap causes the outer router's
        // fee-on-transfer balance-delta measurement (balanceOf(pair) - reserveInput) to read
        // zero once auto-swap's nested pair.swap() syncs reserves — the user's sell then
        // reverts with INSUFFICIENT_INPUT_AMOUNT. Distributing tax first keeps the pair's
        // pre-sell balance clean for auto-swap, and the subsequent super._update below
        // deposits the user's amountAfterTax as a fresh, measurable delta.
        if (taxAmount > 0) {
            _distributeTax(from, taxAmount, transferType);
        }

        // Transfer to recipient (after auto-swap has settled so reserves == balanceOf(pair))
        super._update(from, to, amountAfterTax);
    }

    // ============================================
    // TAX LOGIC
    // ============================================

    function _getTaxInfo(address from, address to)
        private
        view
        returns (bool shouldTax, uint256 taxRate, string memory transferType)
    {
        // Detect transfer type
        bool isBuy = isDexPair[from] && !isDexPair[to];
        bool isSell = !isDexPair[from] && isDexPair[to];
        bool isTransfer = !isDexPair[from] && !isDexPair[to];

        if (isBuy) {
            transferType = "BUY";
            shouldTax = taxBehavior.taxOnBuy;
            taxRate = taxBehavior.buyTax;
        } else if (isSell) {
            transferType = "SELL";
            shouldTax = taxBehavior.taxOnSell;
            taxRate = taxBehavior.sellTax;
        } else if (isTransfer) {
            transferType = "TRANSFER";
            shouldTax = taxBehavior.taxOnTransfer;
            taxRate = taxBehavior.transferTax;
        } else {
            // DEX to DEX transfer (rare edge case)
            transferType = "DEX_TO_DEX";
            shouldTax = false;
            taxRate = 0;
        }
    }

    function _distributeTax(address from, uint256 totalTax, string memory transferType) private {
        // Transfer tax to contract
        super._update(from, address(this), totalTax);
        emit TaxCollected(from, transferType, totalTax, totalTax);

        // Check if we should trigger automatic swap
        if (autoSwapEnabled) {
            uint256 contractBalance = balanceOf(address(this));
            bool canSwap = contractBalance >= swapTokensAtAmount;

            // Auto-swap on sells and transfers, NOT buys.
            // Caller's `_update` defers the main super._update(from, to, amountAfterTax)
            // until after this function returns, so for sells (to == pair) the pair has not
            // yet received the user's tokens. That means pair.swap() here sees only the
            // auto-swap amount and existing reserves, and after it returns, reserves are
            // synced to balanceOf(pair). The caller then credits the pair with amountAfterTax,
            // which the outer router reads cleanly as balanceOf(pair) - reserveInput.
            // Buys (pair→user): we are already inside pair.swap() — the pair's reentrancy
            // lock would revert a nested swap, so we skip to avoid wasting gas.
            if (canSwap && !_inSwap && !isDexPair[from]) {
                uint256 maxSwap = swapTokensAtAmount * MAX_SWAP_MULTIPLIER;
                uint256 swapAmount = contractBalance > maxSwap ? maxSwap : contractBalance;

                try this.autoSwapEntry(swapAmount) {} catch {}
            }
        }
    }

    /// @notice External entry point used only for `try this.autoSwapEntry()` self-calls from `_distributeTax`
    /// @dev Enforces `msg.sender == address(this)` so external callers cannot trigger arbitrary swaps
    function autoSwapEntry(uint256 amount) external {
        require(msg.sender == address(this), "Only self");
        _swapAndDistribute(amount);
    }

    // ============================================
    // SWAP & LIQUIDITY FUNCTIONS
    // ============================================

    /// @notice Modifier to prevent reentrancy during swaps
    modifier lockTheSwap {
        _inSwap = true;
        _;
        _inSwap = false;
    }

    /// @notice Swap tokens for ETH via DEX router.
    /// @dev Passes amountOutMin=0 on purpose: the contract is recycling its own tax into
    /// distributions and LP, so "worst price" just means "pool's current price." Reverting
    /// the whole tax flow over slippage (as happened on shallow pools) is strictly worse
    /// than accepting the market rate. Pattern matches battle-tested tax tokens (1000PDF etc.).
    function _swapTokensForEth(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = dexRouter.WETH();

        _approve(address(this), address(dexRouter), tokenAmount);

        dexRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp + swapDeadline
        );
    }

    /// @notice Add liquidity to DEX at whatever ratio the pool is currently at.
    /// @dev Passes amountTokenMin=0, amountETHMin=0 on purpose. Router's internal quote()
    /// guarantees the ratio matches current reserves — setting non-zero mins was the cause
    /// of INSUFFICIENT_B_AMOUNT reverts on shallow pools (pool price moves during the swap
    /// inside _swapAndDistribute, then addLiquidity's pre-computed mins no longer fit).
    function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        // After ownership is renounced, route LP tokens to the burn address so auto-liquidity
        // keeps functioning and the liquidity stays permanently locked.
        address lpRecipient = owner();
        if (lpRecipient == address(0)) {
            lpRecipient = 0x000000000000000000000000000000000000dEaD;
        }

        _approve(address(this), address(dexRouter), tokenAmount);

        dexRouter.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0,
            0,
            lpRecipient,
            block.timestamp + swapDeadline
        );

        emit LiquidityAdded(tokenAmount, ethAmount, 0);
    }

    /// @notice Main swap and distribute function - swaps tax tokens to ETH and distributes
    /// @param taxAmount Total tax tokens to process
    function _swapAndDistribute(uint256 taxAmount) private lockTheSwap {
        // Separate burn from swappable amounts
        uint256 burnAmount = (taxAmount * taxDistribution.burnPercent) / BASIS_POINTS;
        uint256 liquidityTokens = (taxAmount * taxDistribution.liquidityPercent) / BASIS_POINTS;
        uint256 swapTokens = taxAmount - burnAmount - liquidityTokens;

        // Burn first
        if (burnAmount > 0) {
            super._update(address(this), DEAD_ADDRESS, burnAmount);
            emit Transfer(address(this), DEAD_ADDRESS, burnAmount);
        }

        // Handle auto-liquidity
        if (liquidityTokens > 0) {
            uint256 half = liquidityTokens / 2;
            uint256 otherHalf = liquidityTokens - half;

            uint256 initialBalance = address(this).balance;
            _swapTokensForEth(half);
            uint256 ethForLiquidity = address(this).balance - initialBalance;

            _addLiquidity(otherHalf, ethForLiquidity);
        }

        // Swap remaining for distribution
        if (swapTokens > 0) {
            uint256 initialBalance = address(this).balance;
            _swapTokensForEth(swapTokens);
            uint256 ethForDistribution = address(this).balance - initialBalance;

            // Calculate distribution amounts
            uint256 totalDistPercent = taxDistribution.marketingPercent +
                                       taxDistribution.teamPercent +
                                       taxDistribution.buybackPercent;

            uint256 ethToMarketing = 0;
            uint256 ethToTeam = 0;
            uint256 ethToBuyback = 0;

            if (totalDistPercent > 0) {
                ethToMarketing = (ethForDistribution * taxDistribution.marketingPercent) / totalDistPercent;
                ethToTeam = (ethForDistribution * taxDistribution.teamPercent) / totalDistPercent;
                ethToBuyback = ethForDistribution - ethToMarketing - ethToTeam; // Remaining
            }

            // Distribute ETH using call (supports smart contract wallets)
            if (ethToMarketing > 0) {
                (bool success, ) = taxDistribution.marketingWallet.call{value: ethToMarketing}("");
                if (!success) emit DistributionFailed("marketing", ethToMarketing);
            }
            if (ethToTeam > 0) {
                (bool success, ) = taxDistribution.teamWallet.call{value: ethToTeam}("");
                if (!success) emit DistributionFailed("team", ethToTeam);
            }
            if (ethToBuyback > 0) {
                (bool success, ) = taxDistribution.buybackWallet.call{value: ethToBuyback}("");
                if (!success) emit DistributionFailed("buyback", ethToBuyback);
            }

            emit SwapAndDistribute(swapTokens, ethForDistribution, ethToMarketing, ethToTeam, ethToBuyback);
        }
    }

    /// @notice Allows contract to receive ETH
    receive() external payable {}

    /// @notice Recover ETH stuck in the contract from failed distributions
    function recoverETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to recover");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "ETH recovery failed");
        emit ETHRecovered(balance);
    }

    /// @notice Recover ERC20 tokens accidentally sent to this contract
    /// @param tokenAddress The ERC20 token to recover (cannot be this token)
    /// @param amount Amount to recover
    function recoverERC20(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(this), "Cannot recover own tokens");
        require(amount > 0, "Amount must be > 0");
        IERC20(tokenAddress).transfer(owner(), amount);
        emit ERC20Recovered(tokenAddress, amount);
    }

    /// @notice Manual swap function - allows owner to trigger swap anytime
    /// @dev Useful to avoid users paying for automatic swap gas costs
    function manualSwap() external onlyOwner nonReentrant {
        uint256 contractBalance = balanceOf(address(this));
        require(contractBalance > 0, "No tokens to swap");
        _swapAndDistribute(contractBalance);
    }

    /// @notice Manual swap with custom amount
    /// @param amount Amount of tokens to swap (must be <= contract balance)
    function manualSwapAmount(uint256 amount) external onlyOwner nonReentrant {
        uint256 contractBalance = balanceOf(address(this));
        require(amount > 0 && amount <= contractBalance, "Invalid amount");
        _swapAndDistribute(amount);
    }

    // ============================================
    // OWNER FUNCTIONS - ACCESS CONTROL
    // ============================================

    function setExempt(address account, bool status) external onlyOwner {
        isExempt[account] = status;
        emit ExemptStatusChanged(account, status);
    }

    function setExemptBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            isExempt[accounts[i]] = status;
            emit ExemptStatusChanged(accounts[i], status);
        }
    }

    // ============================================
    // OWNER FUNCTIONS - DEX PAIR MANAGEMENT
    // ============================================

    function setDexPair(address pair, bool status) public onlyOwner {
        if (status && !isDexPair[pair]) {
            _dexPairs.push(pair);
        } else if (!status && isDexPair[pair]) {
            // Remove from array
            for (uint256 i = 0; i < _dexPairs.length; i++) {
                if (_dexPairs[i] == pair) {
                    _dexPairs[i] = _dexPairs[_dexPairs.length - 1];
                    _dexPairs.pop();
                    break;
                }
            }
        }
        isDexPair[pair] = status;
        emit DexPairUpdated(pair, status);
    }

    function setDexPairBatch(address[] calldata pairs, bool status) external onlyOwner {
        for (uint256 i = 0; i < pairs.length; i++) {
            setDexPair(pairs[i], status);
        }
    }

    // ============================================
    // OWNER FUNCTIONS - TAX CONFIGURATION
    // ============================================

    function updateTaxBehavior(TaxBehavior memory newBehavior) external onlyOwner {
        if (newBehavior.transferTax > MAX_TAX) revert TaxTooHigh(newBehavior.transferTax, MAX_TAX);
        if (newBehavior.buyTax > MAX_TAX) revert TaxTooHigh(newBehavior.buyTax, MAX_TAX);
        if (newBehavior.sellTax > MAX_TAX) revert TaxTooHigh(newBehavior.sellTax, MAX_TAX);

        taxBehavior = newBehavior;
        emit TaxBehaviorUpdated(newBehavior);
    }

    function updateTaxDistribution(TaxDistribution memory newDistribution) external onlyOwner {
        uint256 totalDistribution = newDistribution.marketingPercent +
                                     newDistribution.liquidityPercent +
                                     newDistribution.teamPercent +
                                     newDistribution.buybackPercent +
                                     newDistribution.burnPercent;

        if (totalDistribution != BASIS_POINTS) {
            revert InvalidDistribution(totalDistribution, BASIS_POINTS);
        }

        // Validate wallets are set if their percentages > 0
        if (newDistribution.marketingPercent > 0 && newDistribution.marketingWallet == address(0)) {
            revert InvalidTaxWallet("marketing");
        }
        if (newDistribution.teamPercent > 0 && newDistribution.teamWallet == address(0)) {
            revert InvalidTaxWallet("team");
        }
        if (newDistribution.buybackPercent > 0 && newDistribution.buybackWallet == address(0)) {
            revert InvalidTaxWallet("buyback");
        }

        // Remove exemption from old wallets
        if (taxDistribution.marketingWallet != address(0)) isExempt[taxDistribution.marketingWallet] = false;
        if (taxDistribution.teamWallet != address(0)) isExempt[taxDistribution.teamWallet] = false;
        if (taxDistribution.buybackWallet != address(0)) isExempt[taxDistribution.buybackWallet] = false;

        taxDistribution = newDistribution;

        // Add exemption for new wallets
        if (newDistribution.marketingWallet != address(0)) isExempt[newDistribution.marketingWallet] = true;
        if (newDistribution.teamWallet != address(0)) isExempt[newDistribution.teamWallet] = true;
        if (newDistribution.buybackWallet != address(0)) isExempt[newDistribution.buybackWallet] = true;

        emit TaxDistributionUpdated(newDistribution);
    }

    // ============================================
    // OWNER FUNCTIONS - ROUTER & SWAP SETTINGS
    // ============================================

    /// @notice Update the DEX router address
    /// @param newRouter New router address
    function setDexRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router");
        dexRouter = IUniswapV2Router02(newRouter);
        emit RouterUpdated(newRouter);
    }

    /// @notice Update the swap threshold amount
    /// @param newThreshold New threshold for triggering swaps
    function setSwapThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Threshold must be > 0");
        require(newThreshold <= totalSupply() / 50, "Threshold too high"); // Max 2% of supply
        swapTokensAtAmount = newThreshold;
        emit SwapThresholdUpdated(newThreshold);
    }

    /// @notice Update slippage tolerance for DEX operations
    /// @param newTolerance New slippage tolerance (basis points, max 1000 = 10%)
    function setSlippageTolerance(uint256 newTolerance) external onlyOwner {
        require(newTolerance <= MAX_SLIPPAGE, "Slippage too high");
        slippageTolerance = newTolerance;
        emit SlippageToleranceUpdated(newTolerance);
    }

    /// @notice Update swap deadline for DEX operations
    /// @param newDeadline New deadline in seconds (e.g., 300 = 5 minutes)
    function setSwapDeadline(uint256 newDeadline) external onlyOwner {
        require(newDeadline >= 60 && newDeadline <= 3600, "Deadline must be 1-60 minutes");
        swapDeadline = newDeadline;
        emit SwapDeadlineUpdated(newDeadline);
    }

    /// @notice Enable or disable automatic swaps
    /// @param enabled True to enable automatic swaps, false to disable
    function setAutoSwapEnabled(bool enabled) external onlyOwner {
        autoSwapEnabled = enabled;
        emit AutoSwapEnabledUpdated(enabled);
    }

    // ============================================
    // VIEW FUNCTIONS - CORE INFO
    // ============================================

    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    function getTaxBehavior() external view returns (TaxBehavior memory) {
        return taxBehavior;
    }

    function getTaxDistribution() external view returns (TaxDistribution memory) {
        return taxDistribution;
    }

    // ============================================
    // VIEW FUNCTIONS - TAX PREVIEW
    // ============================================

    /// @notice Preview how much tax will be charged for a transfer
    /// @param from Sender address
    /// @param to Recipient address
    /// @param amount Transfer amount
    /// @return taxAmount Total tax that will be charged
    /// @return netAmount Amount recipient will receive
    /// @return transferType Type of transfer (TRANSFER, BUY, SELL)
    function calculateTax(address from, address to, uint256 amount)
        external
        view
        returns (uint256 taxAmount, uint256 netAmount, string memory transferType)
    {
        if (from == address(0) || to == address(0)) {
            return (0, amount, "MINT_OR_BURN");
        }

        if (isExempt[from] || isExempt[to]) {
            return (0, amount, "EXEMPT");
        }

        (bool shouldTax, uint256 taxRate, string memory txType) = _getTaxInfo(from, to);

        if (!shouldTax || taxRate == 0) {
            return (0, amount, txType);
        }

        taxAmount = (amount * taxRate) / BASIS_POINTS;
        netAmount = amount - taxAmount;
        transferType = txType;
    }

    /// @notice Preview full tax distribution breakdown
    /// @param from Sender address
    /// @param to Recipient address
    /// @param amount Transfer amount
    /// @return toRecipient Amount recipient will receive
    /// @return toMarketing Amount to marketing wallet
    /// @return toLiquidity Amount to liquidity wallet
    /// @return toTeam Amount to team wallet
    /// @return toBuyback Amount to buyback wallet
    /// @return toBurn Amount to be burned
    function previewTaxDistribution(address from, address to, uint256 amount)
        external
        view
        returns (
            uint256 toRecipient,
            uint256 toMarketing,
            uint256 toLiquidity,
            uint256 toTeam,
            uint256 toBuyback,
            uint256 toBurn
        )
    {
        (uint256 totalTax, uint256 afterTax,) = this.calculateTax(from, to, amount);

        toRecipient = afterTax;

        if (totalTax > 0) {
            toMarketing = (totalTax * taxDistribution.marketingPercent) / BASIS_POINTS;
            toLiquidity = (totalTax * taxDistribution.liquidityPercent) / BASIS_POINTS;
            toTeam = (totalTax * taxDistribution.teamPercent) / BASIS_POINTS;
            toBuyback = (totalTax * taxDistribution.buybackPercent) / BASIS_POINTS;
            toBurn = (totalTax * taxDistribution.burnPercent) / BASIS_POINTS;
        }
    }

    // ============================================
    // VIEW FUNCTIONS - TRANSFER VALIDATION
    // ============================================

    /// @notice Check if a transfer will succeed with detailed reason
    /// @param from Sender address
    /// @param amount Transfer amount
    /// @return success Whether the transfer will succeed
    /// @return reason Reason for failure (empty if success)
    function canTransfer(address from, address /*to*/, uint256 amount)
        external
        view
        returns (bool success, string memory reason)
    {
        if (balanceOf(from) < amount) {
            return (false, "Insufficient balance");
        }

        return (true, "");
    }

    // ============================================
    // VIEW FUNCTIONS - TRANSFER TYPE DETECTION
    // ============================================

    /// @notice Detect what type of transfer this is
    /// @param from Sender address
    /// @param to Recipient address
    /// @return transferType Type of transfer (MINT, BURN, BUY, SELL, TRANSFER, DEX_TO_DEX)
    function detectTransferType(address from, address to)
        external
        view
        returns (string memory transferType)
    {
        if (from == address(0)) return "MINT";
        if (to == address(0)) return "BURN";
        if (isDexPair[from] && !isDexPair[to]) return "BUY";
        if (!isDexPair[from] && isDexPair[to]) return "SELL";
        if (isDexPair[from] && isDexPair[to]) return "DEX_TO_DEX";
        return "TRANSFER";
    }

    /// @notice Get tax rate for a specific transfer type
    /// @param from Sender address
    /// @param to Recipient address
    /// @return taxRate Tax rate in basis points (0-2500)
    function getTaxRateForTransfer(address from, address to)
        external
        view
        returns (uint256 taxRate)
    {
        (, uint256 rate,) = _getTaxInfo(from, to);
        return rate;
    }

    // ============================================
    // VIEW FUNCTIONS - DEX PAIRS
    // ============================================

    /// @notice Get all registered DEX pairs
    /// @return pairs Array of DEX pair addresses
    function getAllDexPairs() external view returns (address[] memory) {
        return _dexPairs;
    }

    /// @notice Get count of registered DEX pairs
    /// @return count Number of DEX pairs
    function getDexPairCount() external view returns (uint256) {
        return _dexPairs.length;
    }

    // ============================================
    // VIEW FUNCTIONS - TAX WALLETS
    // ============================================

    function getMarketingWallet() external view returns (address) {
        return taxDistribution.marketingWallet;
    }

    function getTeamWallet() external view returns (address) {
        return taxDistribution.teamWallet;
    }

    function getBuybackWallet() external view returns (address) {
        return taxDistribution.buybackWallet;
    }

    // ============================================
    // VIEW FUNCTIONS - TAX STATUS
    // ============================================

    /// @notice Check if any form of tax is enabled
    /// @return enabled True if any tax is active
    function isTaxEnabled() external view returns (bool) {
        return taxBehavior.taxOnBuy || taxBehavior.taxOnSell || taxBehavior.taxOnTransfer;
    }

    /// @notice Get maximum possible tax rate across all transfer types
    /// @return maxRate Maximum tax rate in basis points
    function getMaxActiveTaxRate() external view returns (uint256) {
        uint256 maxRate = 0;
        if (taxBehavior.taxOnTransfer && taxBehavior.transferTax > maxRate) maxRate = taxBehavior.transferTax;
        if (taxBehavior.taxOnBuy && taxBehavior.buyTax > maxRate) maxRate = taxBehavior.buyTax;
        if (taxBehavior.taxOnSell && taxBehavior.sellTax > maxRate) maxRate = taxBehavior.sellTax;
        return maxRate;
    }

    // ============================================
    // VIEW FUNCTIONS - DAPP-COMPATIBLE TAX GETTERS
    // ============================================

    /// @notice Get buy tax rate (basis points) - compatible with DexTools/GoPlus/TokenSniffer
    function buyTax() external view returns (uint256) {
        return taxBehavior.buyTax;
    }

    /// @notice Get sell tax rate (basis points) - compatible with DexTools/GoPlus/TokenSniffer
    function sellTax() external view returns (uint256) {
        return taxBehavior.sellTax;
    }

    /// @notice Get transfer tax rate (basis points)
    function transferTax() external view returns (uint256) {
        return taxBehavior.transferTax;
    }

}