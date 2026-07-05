// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";

/**
 * @title ReflectionTokenImplementation
 * @dev ERC-20 token with UNIFIED fee architecture: single tax rate with reflection as a distribution category
 *
 * Architecture (Unified Fee Model):
 * - ONE single tax rate per transfer type (buy/sell/transfer)
 * - Tax collected is distributed:
 *   - reflectionPercent → redistributed to all holders via RFI mechanism
 *   - marketingPercent  → swapped to ETH → marketing wallet
 *   - liquidityPercent  → auto-added to DEX as liquidity
 *   - teamPercent       → swapped to ETH → team wallet
 *   - buybackPercent    → swapped to ETH → buyback wallet
 *   - All must sum to 10000 (100%)
 *
 * Features:
 * - Separate tax rates for Transfers, Buys, and Sells
 * - Reflection (RFI) is a distribution category, not a separate fee layer
 * - AUTOMATIC reflection to all holders (no claiming needed)
 * - AUTO-SWAP: Non-reflection tax automatically swapped to ETH via DEX Router
 * - AUTO-LIQUIDITY: Liquidity portion auto-added to DEX (LP tokens to owner)
 * - Gas-efficient reflection mechanism (no loops in transfers)
 * - Excludable addresses (liquidity pools, CEX wallets)
 *
 * Builder Freedom:
 * - Choose which transfer types to tax (transfers, buys, sells, or any combination)
 * - Set different tax rates for each type (e.g., 2% transfer, 5% buy, 10% sell)
 * - Choose how tax is distributed: any mix of reflection, marketing, liquidity, team, buyback
 * - Holders earn passive rewards automatically proportional to their balance
 */
contract ReflectionTokenImplementation is Context, Ownable, ReentrancyGuard {

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
        uint256 reflectionPercent;  // % of tax redistributed to holders via RFI (0-10000)
        uint256 marketingPercent;   // % of tax to marketing (0-10000) → ETH
        uint256 liquidityPercent;   // % of tax to auto-liquidity (0-10000) → Auto-add to DEX
        uint256 teamPercent;        // % of tax to team (0-10000) → ETH
        uint256 buybackPercent;     // % of tax to buyback (0-10000) → ETH
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

    mapping(address => uint256) private _rOwned;   // Reflection balances
    mapping(address => uint256) private _tOwned;   // Actual balances for excluded addresses
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _isExcludedFromFee;
    mapping(address => bool) private _isExcluded;  // Excluded from rewards
    mapping(address => bool) public isDexPair;     // DEX pairs for buy/sell detection

    address[] private _excluded;
    address[] private _dexPairs;                    // Array to track all DEX pairs

    IUniswapV2Router02 public dexRouter;            // DEX router for swaps
    uint256 public swapTokensAtAmount;              // Threshold to trigger swap
    bool private _inSwap;                           // Prevent recursion during swaps
    bool public autoSwapEnabled;                    // Enable/disable automatic swaps

    uint256 private constant MAX = ~uint256(0);
    uint256 private _tTotal;                        // Total token supply
    uint256 private _rTotal;                        // Total reflection supply
    uint256 private _tFeeTotal;                     // Total fees collected

    bool private _initialized;

    // Slippage protection for DEX operations
    uint256 public slippageTolerance = 500;         // 5% default slippage tolerance (500/10000)
    uint256 public swapDeadline = 300;              // 5 minutes default deadline

    uint256 public constant MAX_TAX = 2500;         // 25% max tax per transaction
    uint256 public constant MAX_SLIPPAGE = 1000;    // 10% max slippage tolerance
    uint256 public constant BASIS_POINTS = 10000;   // 100%
    uint256 public constant MAX_SWAP_MULTIPLIER = 20;
    uint256 public constant MAX_EXCLUDED = 50;      // Max addresses excludable from rewards

    // ============================================
    // EVENTS
    // ============================================

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event ReflectionDistributed(string transferType, uint256 tFee, uint256 rFee);
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
    event ExcludedFromReward(address indexed account);
    event IncludedInReward(address indexed account);
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
    event FeeExclusionChanged(address indexed account, bool excluded);

    // ============================================
    // ERRORS
    // ============================================

    error AlreadyInitialized();
    error TaxTooHigh(uint256 provided, uint256 max);
    error InvalidTaxWallet(string walletType);
    error InvalidDistribution(uint256 total, uint256 expected);
    error InsufficientBalance();
    error InsufficientAllowance();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor() Ownable(msg.sender) {
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
        require(totalSupply_ > 0, "Total supply must be > 0");

        // Validate tax rates
        if (taxBehavior_.transferTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.transferTax, MAX_TAX);
        if (taxBehavior_.buyTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.buyTax, MAX_TAX);
        if (taxBehavior_.sellTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.sellTax, MAX_TAX);

        // Validate tax distribution adds up to 100%
        _validateDistribution(taxDistribution_);

        _tokenName = name_;
        _tokenSymbol = symbol_;
        _decimals = decimals_;
        taxBehavior = taxBehavior_;
        taxDistribution = taxDistribution_;

        // Initialize router and swap threshold
        dexRouter = IUniswapV2Router02(dexRouter_);
        swapTokensAtAmount = totalSupply_ / 20000; // 0.005% of supply
        autoSwapEnabled = true;

        // Initialize slippage protection defaults
        slippageTolerance = 500;  // 5% default
        swapDeadline = 300;       // 5 minutes default

        _tTotal = totalSupply_;
        _rTotal = (MAX - (MAX % _tTotal));

        _transferOwnership(owner_);

        if (totalSupply_ > 0) {
            _rOwned[owner_] = _rTotal;
            emit Transfer(address(0), owner_, totalSupply_);
        }

        // Exclude owner and this contract from fees
        _isExcludedFromFee[owner_] = true;
        _isExcludedFromFee[address(this)] = true;

        // Exclude tax wallets from fees
        if (taxDistribution_.marketingWallet != address(0)) _isExcludedFromFee[taxDistribution_.marketingWallet] = true;
        if (taxDistribution_.teamWallet != address(0)) _isExcludedFromFee[taxDistribution_.teamWallet] = true;
        if (taxDistribution_.buybackWallet != address(0)) _isExcludedFromFee[taxDistribution_.buybackWallet] = true;

        // Exclude contract and tax wallets from rewards (prevents reflection leakage)
        // IMPORTANT: Must set _tOwned when excluding addresses that hold tokens,
        // and must avoid pushing duplicates to the _excluded array.
        _excludeFromRewardInit(address(this));
        if (taxDistribution_.marketingWallet != address(0)) {
            _excludeFromRewardInit(taxDistribution_.marketingWallet);
        }
        if (taxDistribution_.teamWallet != address(0)) {
            _excludeFromRewardInit(taxDistribution_.teamWallet);
        }
        if (taxDistribution_.buybackWallet != address(0)) {
            _excludeFromRewardInit(taxDistribution_.buybackWallet);
        }

        _initialized = true;
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    /// @dev Exclude an address from rewards during initialize().
    /// Unlike the public excludeFromReward(), this is called before _initialized is set,
    /// handles duplicates (same address used for multiple tax wallets), and correctly
    /// populates _tOwned so balanceOf returns the right value for excluded holders.
    function _excludeFromRewardInit(address account) private {
        if (_isExcluded[account]) return; // Skip duplicates — prevents array bloat & double-subtraction in _getCurrentSupply
        if (_rOwned[account] > 0) {
            _tOwned[account] = tokenFromReflection(_rOwned[account]);
        }
        _isExcluded[account] = true;
        _excluded.push(account);
    }

    function _validateDistribution(TaxDistribution memory dist) private pure {
        uint256 totalDistribution = dist.reflectionPercent +
                                     dist.marketingPercent +
                                     dist.liquidityPercent +
                                     dist.teamPercent +
                                     dist.buybackPercent;

        if (totalDistribution != BASIS_POINTS) {
            revert InvalidDistribution(totalDistribution, BASIS_POINTS);
        }

        // Validate wallets are set if their percentages > 0
        if (dist.marketingPercent > 0 && dist.marketingWallet == address(0)) {
            revert InvalidTaxWallet("marketing");
        }
        if (dist.teamPercent > 0 && dist.teamWallet == address(0)) {
            revert InvalidTaxWallet("team");
        }
        if (dist.buybackPercent > 0 && dist.buybackWallet == address(0)) {
            revert InvalidTaxWallet("buyback");
        }
    }

    // ============================================
    // ERC20 STANDARD FUNCTIONS
    // ============================================

    function name() public view returns (string memory) {
        return _tokenName;
    }

    function symbol() public view returns (string memory) {
        return _tokenSymbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view returns (uint256) {
        return _tTotal;
    }

    function balanceOf(address account) public view returns (uint256) {
        if (_isExcluded[account]) return _tOwned[account];
        return tokenFromReflection(_rOwned[account]);
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(_msgSender(), to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[from][_msgSender()];
        if (currentAllowance < amount) revert InsufficientAllowance();
        unchecked {
            _approve(from, _msgSender(), currentAllowance - amount);
        }

        _transfer(from, to, amount);
        return true;
    }

    // ============================================
    // REFLECTION MECHANISM
    // ============================================

    function tokenFromReflection(uint256 rAmount) public view returns (uint256) {
        if (rAmount > _rTotal) revert InsufficientBalance();
        uint256 currentRate = _getRate();
        return rAmount / currentRate;
    }

    function _getRate() private view returns (uint256) {
        (uint256 rSupply, uint256 tSupply) = _getCurrentSupply();
        return rSupply / tSupply;
    }

    function _getCurrentSupply() private view returns (uint256, uint256) {
        uint256 rSupply = _rTotal;
        uint256 tSupply = _tTotal;

        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_rOwned[_excluded[i]] > rSupply || _tOwned[_excluded[i]] > tSupply) {
                return (_rTotal, _tTotal);
            }
            rSupply -= _rOwned[_excluded[i]];
            tSupply -= _tOwned[_excluded[i]];
        }

        if (rSupply < _rTotal / _tTotal) return (_rTotal, _tTotal);
        return (rSupply, tSupply);
    }

    function _reflectFee(uint256 rFee, uint256 tFee, string memory transferType) private {
        _rTotal -= rFee;
        _tFeeTotal += tFee;
        emit ReflectionDistributed(transferType, tFee, rFee);
    }

    // ============================================
    // TRANSFER LOGIC
    // ============================================

    function _transfer(address from, address to, uint256 amount) private {
        if (from == address(0) || to == address(0)) revert("Transfer from/to zero address");
        if (amount == 0) {
            emit Transfer(from, to, 0);
            return;
        }
        if (balanceOf(from) < amount) revert InsufficientBalance();

        // Determine if we should take fees
        (bool shouldTax, uint256 taxRate, string memory transferType) = _getFeesInfo(from, to);

        _tokenTransfer(from, to, amount, shouldTax, taxRate, transferType);
    }

    function _getFeesInfo(address from, address to)
        private
        view
        returns (
            bool shouldTax,
            uint256 taxRate,
            string memory transferType
        )
    {
        // Skip fees if either party is excluded from fees
        if (_isExcludedFromFee[from] || _isExcludedFromFee[to]) {
            return (false, 0, "EXEMPT");
        }

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
            // DEX to DEX transfer
            transferType = "DEX_TO_DEX";
            shouldTax = false;
            taxRate = 0;
        }
    }

    function _tokenTransfer(
        address sender,
        address recipient,
        uint256 tAmount,
        bool shouldTax,
        uint256 taxRate,
        string memory transferType
    ) private {
        uint256 currentRate = _getRate();

        // Calculate unified tax
        uint256 tTotalFee = 0;
        if (shouldTax && taxRate > 0) {
            tTotalFee = (tAmount * taxRate) / BASIS_POINTS;
        }

        // Split tax into reflection and contract portions
        uint256 tReflectionFee = 0;
        uint256 tContractFee = 0;
        if (tTotalFee > 0) {
            tReflectionFee = (tTotalFee * taxDistribution.reflectionPercent) / BASIS_POINTS;
            tContractFee = tTotalFee - tReflectionFee;
        }

        uint256 tTransferAmount = tAmount - tTotalFee;

        uint256 rAmount = tAmount * currentRate;
        uint256 rReflectionFee = tReflectionFee * currentRate;
        uint256 rContractFee = tContractFee * currentRate;
        uint256 rTransferAmount = rAmount - rReflectionFee - rContractFee;

        // Update sender balances
        if (_isExcluded[sender]) _tOwned[sender] -= tAmount;
        _rOwned[sender] -= rAmount;

        // Handle reflection (distribute to all holders)
        if (tReflectionFee > 0) {
            _reflectFee(rReflectionFee, tReflectionFee, transferType);
        }

        // Handle contract tax (send to contract for swapping)
        // IMPORTANT: autoSwap must run BEFORE crediting the recipient. If the recipient is
        // the DEX pair (sell/transfer-to-pair), crediting it first means auto-swap's nested
        // pair.swap() syncs reserves to include the user's pending tokens. The outer router
        // then reads balanceOf(pair) - reserveInput == 0 for the user's sell and reverts with
        // INSUFFICIENT_INPUT_AMOUNT. Running auto-swap while the pair still holds only its
        // existing reserves (+ the autoSwap deposit) keeps the subsequent recipient credit
        // visible as a clean balance delta to the outer router.
        if (tContractFee > 0) {
            if (_isExcluded[address(this)]) _tOwned[address(this)] += tContractFee;
            _rOwned[address(this)] += rContractFee;
            emit TaxCollected(sender, transferType, tTotalFee, tContractFee);

            // Check if we should trigger automatic swap
            if (autoSwapEnabled) {
                uint256 contractBalance = balanceOf(address(this));
                bool canSwap = contractBalance >= swapTokensAtAmount;

                // Auto-swap on sells and transfers, NOT buys.
                // Recipient credit is deferred until after this block, so for sells
                // (recipient == pair) the pair has not yet received the user's tokens.
                // pair.swap() here sees only the auto-swap deposit and pre-sell reserves,
                // and after it returns reserves are synced to balanceOf(pair). The
                // recipient credit below then lands as a fresh delta the outer router
                // can measure via balanceOf(pair) - reserveInput.
                // Buys (pair→user): we are already inside pair.swap() — the pair's reentrancy
                // lock would revert a nested swap, so we skip to avoid wasting gas.
                if (canSwap && !_inSwap && !isDexPair[sender]) {
                    uint256 maxSwap = swapTokensAtAmount * MAX_SWAP_MULTIPLIER;
                    uint256 swapAmount = contractBalance > maxSwap ? maxSwap : contractBalance;

                    try this.autoSwapEntry(swapAmount) {} catch {}
                }
            }
        }

        // Update recipient balances (AFTER auto-swap so reserves == balanceOf(pair) at this point,
        // and the outer router cleanly sees this credit as the fee-on-transfer input amount).
        if (_isExcluded[recipient]) _tOwned[recipient] += tTransferAmount;
        _rOwned[recipient] += rTransferAmount;

        emit Transfer(sender, recipient, tTransferAmount);
    }

    /// @notice External entry point used only for `try this.autoSwapEntry()` self-calls from `_tokenTransfer`
    /// @dev Enforces `msg.sender == address(this)` so external callers cannot trigger arbitrary swaps
    function autoSwapEntry(uint256 amount) external {
        require(msg.sender == address(this), "Only self");
        _swapAndDistribute(amount);
    }

    function _approve(address owner, address spender, uint256 amount) private {
        if (owner == address(0) || spender == address(0)) revert("Approve from/to zero address");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
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

    /// @notice Swaps accumulated tax tokens for ETH via DEX router
    /// @dev Passes 0 as amountOutMin — we are recycling our own tax, not trading with an adversary,
    ///      and a revert here would strand tokens forever on shallow pairs. Matches 1000PDF pattern.
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

    /// @notice Adds liquidity to DEX from accumulated tax
    /// @dev Passes 0 for both min amounts — the router's internal quote() enforces correct ratio,
    ///      so any non-reverting call already gets a fair deposit. Strict mins revert on price drift
    ///      between the preceding swap and this call, which is why auto-liquidity silently fails on
    ///      shallow pairs. Matches 1000PDF pattern.
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

    /// @notice Main swap and distribute function
    /// @dev Only processes tokens in contract (reflection already distributed during transfer)
    function _swapAndDistribute(uint256 taxAmount) private lockTheSwap {
        // Calculate proportional distribution for non-reflection categories
        uint256 nonReflectionTotal = BASIS_POINTS - taxDistribution.reflectionPercent;
        if (nonReflectionTotal == 0) return; // 100% reflection, nothing to swap

        uint256 liquidityTokens = (taxAmount * taxDistribution.liquidityPercent) / nonReflectionTotal;
        uint256 swapTokens = taxAmount - liquidityTokens;

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
                ethToBuyback = ethForDistribution - ethToMarketing - ethToTeam;
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

    /// @notice Manual swap function
    function manualSwap() external onlyOwner nonReentrant {
        uint256 contractBalance = balanceOf(address(this));
        require(contractBalance > 0, "No tokens to swap");
        _swapAndDistribute(contractBalance);
    }

    /// @notice Manual swap with custom amount
    function manualSwapAmount(uint256 amount) external onlyOwner nonReentrant {
        uint256 contractBalance = balanceOf(address(this));
        require(amount > 0 && amount <= contractBalance, "Invalid amount");
        _swapAndDistribute(amount);
    }

    // ============================================
    // OWNER FUNCTIONS - EXCLUSIONS
    // ============================================

    function excludeFromReward(address account) external onlyOwner {
        if (_isExcluded[account]) return;
        require(_excluded.length < MAX_EXCLUDED, "Too many excluded addresses");

        if (_rOwned[account] > 0) {
            _tOwned[account] = tokenFromReflection(_rOwned[account]);
        }
        _isExcluded[account] = true;
        _excluded.push(account);
        emit ExcludedFromReward(account);
    }

    function includeInReward(address account) external onlyOwner {
        if (!_isExcluded[account]) return;

        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_excluded[i] == account) {
                // Do NOT recompute _rOwned here: the stored value was frozen at exclusion time and
                // the global invariant sum(_rOwned) == _rTotal is already maintained. Recomputing
                // from _tOwned * _getRate() would break supply conservation.
                _tOwned[account] = 0;
                _isExcluded[account] = false;
                _excluded[i] = _excluded[_excluded.length - 1];
                _excluded.pop();

                emit IncludedInReward(account);
                break;
            }
        }
    }

    function excludeFromFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = true;
        emit FeeExclusionChanged(account, true);
    }

    function includeInFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = false;
        emit FeeExclusionChanged(account, false);
    }

    // ============================================
    // OWNER FUNCTIONS - DEX PAIR MANAGEMENT
    // ============================================

    function setDexPair(address pair, bool status) public onlyOwner {
        if (status && !isDexPair[pair]) {
            _dexPairs.push(pair);
        } else if (!status && isDexPair[pair]) {
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
        _validateDistribution(newDistribution);

        // Remove fee exemption from old wallets
        if (taxDistribution.marketingWallet != address(0)) _isExcludedFromFee[taxDistribution.marketingWallet] = false;
        if (taxDistribution.teamWallet != address(0)) _isExcludedFromFee[taxDistribution.teamWallet] = false;
        if (taxDistribution.buybackWallet != address(0)) _isExcludedFromFee[taxDistribution.buybackWallet] = false;

        taxDistribution = newDistribution;

        // Add fee exemption for new wallets
        if (newDistribution.marketingWallet != address(0)) _isExcludedFromFee[newDistribution.marketingWallet] = true;
        if (newDistribution.teamWallet != address(0)) _isExcludedFromFee[newDistribution.teamWallet] = true;
        if (newDistribution.buybackWallet != address(0)) _isExcludedFromFee[newDistribution.buybackWallet] = true;

        emit TaxDistributionUpdated(newDistribution);
    }

    // ============================================
    // OWNER FUNCTIONS - ROUTER & SWAP SETTINGS
    // ============================================

    function setDexRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router");
        dexRouter = IUniswapV2Router02(newRouter);
        emit RouterUpdated(newRouter);
    }

    function setSwapThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Threshold must be > 0");
        require(newThreshold <= _tTotal / 50, "Threshold too high"); // Max 2% of supply
        swapTokensAtAmount = newThreshold;
        emit SwapThresholdUpdated(newThreshold);
    }

    function setSlippageTolerance(uint256 newTolerance) external onlyOwner {
        require(newTolerance <= MAX_SLIPPAGE, "Slippage too high");
        slippageTolerance = newTolerance;
        emit SlippageToleranceUpdated(newTolerance);
    }

    function setSwapDeadline(uint256 newDeadline) external onlyOwner {
        require(newDeadline >= 60 && newDeadline <= 3600, "Deadline must be 1-60 minutes");
        swapDeadline = newDeadline;
        emit SwapDeadlineUpdated(newDeadline);
    }

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

    function totalFees() external view returns (uint256) {
        return _tFeeTotal;
    }

    function isExcludedFromReward(address account) external view returns (bool) {
        return _isExcluded[account];
    }

    function isExcludedFromFee(address account) external view returns (bool) {
        return _isExcludedFromFee[account];
    }

    // ============================================
    // VIEW FUNCTIONS - REFLECTION PREVIEW
    // ============================================

    /// @notice Preview tax and reflection for a transfer
    /// @param from Sender address
    /// @param to Recipient address
    /// @param amount Transfer amount
    /// @return reflectionFee Amount that will be reflected to holders
    /// @return netAmount Amount recipient will receive
    /// @return transferType Type of transfer (TRANSFER, BUY, SELL)
    function calculateReflection(address from, address to, uint256 amount)
        external
        view
        returns (uint256 reflectionFee, uint256 netAmount, string memory transferType)
    {
        if (from == address(0) || to == address(0)) {
            return (0, amount, "MINT_OR_BURN");
        }

        (bool shouldTax, uint256 taxRate, string memory txType) = _getFeesInfo(from, to);

        uint256 totalFee = 0;
        if (shouldTax && taxRate > 0) {
            totalFee = (amount * taxRate) / BASIS_POINTS;
            reflectionFee = (totalFee * taxDistribution.reflectionPercent) / BASIS_POINTS;
        }

        netAmount = amount - totalFee;
        transferType = txType;
    }

    // ============================================
    // VIEW FUNCTIONS - TRANSFER VALIDATION
    // ============================================

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

    /// @notice Get tax rate for a specific transfer
    function getTaxRateForTransfer(address from, address to)
        external
        view
        returns (uint256 taxRate)
    {
        (, uint256 rate,) = _getFeesInfo(from, to);
        return rate;
    }

    // ============================================
    // VIEW FUNCTIONS - DEX PAIRS
    // ============================================

    function getAllDexPairs() external view returns (address[] memory) {
        return _dexPairs;
    }

    function getDexPairCount() external view returns (uint256) {
        return _dexPairs.length;
    }

    // ============================================
    // VIEW FUNCTIONS - REFLECTION STATUS
    // ============================================

    /// @notice Check if reflection is enabled (non-zero reflectionPercent in distribution)
    function isReflectionEnabled() external view returns (bool) {
        return taxDistribution.reflectionPercent > 0;
    }

    /// @notice Get reflection statistics
    function getReflectionStatistics()
        external
        view
        returns (uint256 totalReflected, uint256 reflectionRate)
    {
        totalReflected = _tFeeTotal;
        reflectionRate = _getRate();
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
