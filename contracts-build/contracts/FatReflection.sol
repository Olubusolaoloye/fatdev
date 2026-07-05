// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";

/**
 * @title FatReflection
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
 */
contract FatReflection is Context, Ownable, ReentrancyGuard {

    // ============================================
    // STRUCTS
    // ============================================

    struct TaxBehavior {
        bool taxOnTransfer;
        bool taxOnBuy;
        bool taxOnSell;
        uint256 transferTax;
        uint256 buyTax;
        uint256 sellTax;
    }

    struct TaxDistribution {
        uint256 reflectionPercent;  // % redistributed to holders via RFI (0-10000)
        uint256 marketingPercent;
        uint256 liquidityPercent;
        uint256 teamPercent;
        uint256 buybackPercent;
        // These MUST add up to 10000

        address marketingWallet;
        address teamWallet;
        address buybackWallet;
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    string private _tokenName;
    string private _tokenSymbol;
    uint8 private _decimals;

    TaxBehavior public taxBehavior;
    TaxDistribution public taxDistribution;

    mapping(address => uint256) private _rOwned;
    mapping(address => uint256) private _tOwned;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _isExcludedFromFee;
    mapping(address => bool) private _isExcluded;
    mapping(address => bool) public isDexPair;

    address[] private _excluded;
    address[] private _dexPairs;

    IUniswapV2Router02 public dexRouter;
    uint256 public swapTokensAtAmount;
    bool private _inSwap;
    bool public autoSwapEnabled;

    uint256 private constant MAX = ~uint256(0);
    uint256 private _tTotal;
    uint256 private _rTotal;
    uint256 private _tFeeTotal;

    bool private _initialized;

    uint256 public slippageTolerance = 500;
    uint256 public swapDeadline = 300;

    uint256 public constant MAX_TAX = 2500;
    uint256 public constant MAX_SLIPPAGE = 1000;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_SWAP_MULTIPLIER = 20;
    uint256 public constant MAX_EXCLUDED = 50;

    // ============================================
    // EVENTS
    // ============================================

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event ReflectionDistributed(string transferType, uint256 tFee, uint256 rFee);
    event TaxCollected(address indexed from, string transferType, uint256 totalTax, uint256 tokensToContract);
    event SwapAndDistribute(uint256 tokensSwapped, uint256 ethReceived, uint256 ethToMarketing, uint256 ethToTeam, uint256 ethToBuyback);
    event LiquidityAdded(uint256 tokensAdded, uint256 ethAdded, uint256 liquidity);
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

        if (taxBehavior_.transferTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.transferTax, MAX_TAX);
        if (taxBehavior_.buyTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.buyTax, MAX_TAX);
        if (taxBehavior_.sellTax > MAX_TAX) revert TaxTooHigh(taxBehavior_.sellTax, MAX_TAX);

        _validateDistribution(taxDistribution_);

        _tokenName = name_;
        _tokenSymbol = symbol_;
        _decimals = decimals_;
        taxBehavior = taxBehavior_;
        taxDistribution = taxDistribution_;

        dexRouter = IUniswapV2Router02(dexRouter_);
        swapTokensAtAmount = totalSupply_ / 20000;
        autoSwapEnabled = true;

        slippageTolerance = 500;
        swapDeadline = 300;

        _tTotal = totalSupply_;
        _rTotal = (MAX - (MAX % _tTotal));

        _transferOwnership(owner_);

        if (totalSupply_ > 0) {
            _rOwned[owner_] = _rTotal;
            emit Transfer(address(0), owner_, totalSupply_);
        }

        _isExcludedFromFee[owner_] = true;
        _isExcludedFromFee[address(this)] = true;

        if (taxDistribution_.marketingWallet != address(0)) _isExcludedFromFee[taxDistribution_.marketingWallet] = true;
        if (taxDistribution_.teamWallet != address(0)) _isExcludedFromFee[taxDistribution_.teamWallet] = true;
        if (taxDistribution_.buybackWallet != address(0)) _isExcludedFromFee[taxDistribution_.buybackWallet] = true;

        _excludeFromRewardInit(address(this));
        if (taxDistribution_.marketingWallet != address(0)) _excludeFromRewardInit(taxDistribution_.marketingWallet);
        if (taxDistribution_.teamWallet != address(0)) _excludeFromRewardInit(taxDistribution_.teamWallet);
        if (taxDistribution_.buybackWallet != address(0)) _excludeFromRewardInit(taxDistribution_.buybackWallet);

        _initialized = true;
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    function _excludeFromRewardInit(address account) private {
        if (_isExcluded[account]) return;
        if (_rOwned[account] > 0) {
            _tOwned[account] = tokenFromReflection(_rOwned[account]);
        }
        _isExcluded[account] = true;
        _excluded.push(account);
    }

    function _validateDistribution(TaxDistribution memory dist) private pure {
        uint256 totalDistribution = dist.reflectionPercent + dist.marketingPercent +
                                     dist.liquidityPercent + dist.teamPercent + dist.buybackPercent;

        if (totalDistribution != BASIS_POINTS) revert InvalidDistribution(totalDistribution, BASIS_POINTS);
        if (dist.marketingPercent > 0 && dist.marketingWallet == address(0)) revert InvalidTaxWallet("marketing");
        if (dist.teamPercent > 0 && dist.teamWallet == address(0)) revert InvalidTaxWallet("team");
        if (dist.buybackPercent > 0 && dist.buybackWallet == address(0)) revert InvalidTaxWallet("buyback");
    }

    // ============================================
    // ERC20 STANDARD FUNCTIONS
    // ============================================

    function name() public view returns (string memory) { return _tokenName; }
    function symbol() public view returns (string memory) { return _tokenSymbol; }
    function decimals() public view returns (uint8) { return _decimals; }
    function totalSupply() public view returns (uint256) { return _tTotal; }

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
        unchecked { _approve(from, _msgSender(), currentAllowance - amount); }
        _transfer(from, to, amount);
        return true;
    }

    // ============================================
    // REFLECTION MECHANISM
    // ============================================

    function tokenFromReflection(uint256 rAmount) public view returns (uint256) {
        if (rAmount > _rTotal) revert InsufficientBalance();
        return rAmount / _getRate();
    }

    function _getRate() private view returns (uint256) {
        (uint256 rSupply, uint256 tSupply) = _getCurrentSupply();
        return rSupply / tSupply;
    }

    function _getCurrentSupply() private view returns (uint256, uint256) {
        uint256 rSupply = _rTotal;
        uint256 tSupply = _tTotal;

        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_rOwned[_excluded[i]] > rSupply || _tOwned[_excluded[i]] > tSupply) return (_rTotal, _tTotal);
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
        if (amount == 0) { emit Transfer(from, to, 0); return; }
        if (balanceOf(from) < amount) revert InsufficientBalance();

        (bool shouldTax, uint256 taxRate, string memory transferType) = _getFeesInfo(from, to);
        _tokenTransfer(from, to, amount, shouldTax, taxRate, transferType);
    }

    function _getFeesInfo(address from, address to)
        private view
        returns (bool shouldTax, uint256 taxRate, string memory transferType)
    {
        if (_isExcludedFromFee[from] || _isExcludedFromFee[to]) return (false, 0, "EXEMPT");

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

    function _tokenTransfer(
        address sender, address recipient, uint256 tAmount,
        bool shouldTax, uint256 taxRate, string memory transferType
    ) private {
        uint256 currentRate = _getRate();

        uint256 tTotalFee = 0;
        if (shouldTax && taxRate > 0) {
            tTotalFee = (tAmount * taxRate) / BASIS_POINTS;
        }

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

        if (_isExcluded[sender]) _tOwned[sender] -= tAmount;
        _rOwned[sender] -= rAmount;

        if (tReflectionFee > 0) {
            _reflectFee(rReflectionFee, tReflectionFee, transferType);
        }

        if (tContractFee > 0) {
            if (_isExcluded[address(this)]) _tOwned[address(this)] += tContractFee;
            _rOwned[address(this)] += rContractFee;
            emit TaxCollected(sender, transferType, tTotalFee, tContractFee);

            if (autoSwapEnabled) {
                uint256 contractBalance = balanceOf(address(this));
                bool canSwap = contractBalance >= swapTokensAtAmount;

                if (canSwap && !_inSwap && !isDexPair[sender]) {
                    uint256 maxSwap = swapTokensAtAmount * MAX_SWAP_MULTIPLIER;
                    uint256 swapAmount = contractBalance > maxSwap ? maxSwap : contractBalance;
                    try this.autoSwapEntry(swapAmount) {} catch {}
                }
            }
        }

        if (_isExcluded[recipient]) _tOwned[recipient] += tTransferAmount;
        _rOwned[recipient] += rTransferAmount;

        emit Transfer(sender, recipient, tTransferAmount);
    }

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
        uint256 nonReflectionTotal = BASIS_POINTS - taxDistribution.reflectionPercent;
        if (nonReflectionTotal == 0) return;

        uint256 liquidityTokens = (taxAmount * taxDistribution.liquidityPercent) / nonReflectionTotal;
        uint256 swapTokens = taxAmount - liquidityTokens;

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

    function excludeFromReward(address account) external onlyOwner {
        if (_isExcluded[account]) return;
        require(_excluded.length < MAX_EXCLUDED, "Too many excluded addresses");
        if (_rOwned[account] > 0) _tOwned[account] = tokenFromReflection(_rOwned[account]);
        _isExcluded[account] = true;
        _excluded.push(account);
        emit ExcludedFromReward(account);
    }

    function includeInReward(address account) external onlyOwner {
        if (!_isExcluded[account]) return;
        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_excluded[i] == account) {
                _tOwned[account] = 0;
                _isExcluded[account] = false;
                _excluded[i] = _excluded[_excluded.length - 1];
                _excluded.pop();
                emit IncludedInReward(account);
                break;
            }
        }
    }

    function excludeFromFee(address account) external onlyOwner { _isExcludedFromFee[account] = true; emit FeeExclusionChanged(account, true); }
    function includeInFee(address account) external onlyOwner { _isExcludedFromFee[account] = false; emit FeeExclusionChanged(account, false); }

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
        _validateDistribution(newDistribution);

        if (taxDistribution.marketingWallet != address(0)) _isExcludedFromFee[taxDistribution.marketingWallet] = false;
        if (taxDistribution.teamWallet != address(0)) _isExcludedFromFee[taxDistribution.teamWallet] = false;
        if (taxDistribution.buybackWallet != address(0)) _isExcludedFromFee[taxDistribution.buybackWallet] = false;

        taxDistribution = newDistribution;

        if (newDistribution.marketingWallet != address(0)) _isExcludedFromFee[newDistribution.marketingWallet] = true;
        if (newDistribution.teamWallet != address(0)) _isExcludedFromFee[newDistribution.teamWallet] = true;
        if (newDistribution.buybackWallet != address(0)) _isExcludedFromFee[newDistribution.buybackWallet] = true;

        emit TaxDistributionUpdated(newDistribution);
    }

    function setDexRouter(address newRouter) external onlyOwner { require(newRouter != address(0), "Invalid router"); dexRouter = IUniswapV2Router02(newRouter); emit RouterUpdated(newRouter); }
    function setSwapThreshold(uint256 newThreshold) external onlyOwner { require(newThreshold > 0, "Threshold must be > 0"); require(newThreshold <= _tTotal / 50, "Threshold too high"); swapTokensAtAmount = newThreshold; emit SwapThresholdUpdated(newThreshold); }
    function setSlippageTolerance(uint256 newTolerance) external onlyOwner { require(newTolerance <= MAX_SLIPPAGE, "Slippage too high"); slippageTolerance = newTolerance; emit SlippageToleranceUpdated(newTolerance); }
    function setSwapDeadline(uint256 newDeadline) external onlyOwner { require(newDeadline >= 60 && newDeadline <= 3600, "Deadline must be 1-60 minutes"); swapDeadline = newDeadline; emit SwapDeadlineUpdated(newDeadline); }
    function setAutoSwapEnabled(bool enabled) external onlyOwner { autoSwapEnabled = enabled; emit AutoSwapEnabledUpdated(enabled); }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function isInitialized() external view returns (bool) { return _initialized; }
    function getTaxBehavior() external view returns (TaxBehavior memory) { return taxBehavior; }
    function getTaxDistribution() external view returns (TaxDistribution memory) { return taxDistribution; }
    function totalFees() external view returns (uint256) { return _tFeeTotal; }
    function isExcludedFromReward(address account) external view returns (bool) { return _isExcluded[account]; }
    function isExcludedFromFee(address account) external view returns (bool) { return _isExcludedFromFee[account]; }

    function calculateReflection(address from, address to, uint256 amount)
        external view returns (uint256 reflectionFee, uint256 netAmount, string memory transferType)
    {
        if (from == address(0) || to == address(0)) return (0, amount, "MINT_OR_BURN");
        (bool shouldTax, uint256 taxRate, string memory txType) = _getFeesInfo(from, to);
        uint256 totalFee = 0;
        if (shouldTax && taxRate > 0) {
            totalFee = (amount * taxRate) / BASIS_POINTS;
            reflectionFee = (totalFee * taxDistribution.reflectionPercent) / BASIS_POINTS;
        }
        netAmount = amount - totalFee;
        transferType = txType;
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
        (, uint256 rate,) = _getFeesInfo(from, to); return rate;
    }

    function getAllDexPairs() external view returns (address[] memory) { return _dexPairs; }
    function getDexPairCount() external view returns (uint256) { return _dexPairs.length; }

    function isReflectionEnabled() external view returns (bool) { return taxDistribution.reflectionPercent > 0; }

    function getReflectionStatistics() external view returns (uint256 totalReflected, uint256 reflectionRate) {
        totalReflected = _tFeeTotal;
        reflectionRate = _getRate();
    }

    function buyTax() external view returns (uint256) { return taxBehavior.buyTax; }
    function sellTax() external view returns (uint256) { return taxBehavior.sellTax; }
    function transferTax() external view returns (uint256) { return taxBehavior.transferTax; }

}
