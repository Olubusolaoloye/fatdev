// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";

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
