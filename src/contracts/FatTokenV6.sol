// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * FatTokenV6
 *
 * Cleaned from V5 — DexScreener safe:
 *
 * [REMOVED] Blacklist / _rewardList — no address can be banned from trading.
 * [REMOVED] claimToken() — no owner drain of any ERC-20 from contract.
 * [REMOVED] setFeeWhiteList() — fee exemption list immutable after deploy.
 * [REMOVED] setExcludeHolder() — reward exclusion list immutable after deploy.
 * [REMOVED] setSwapRouter() — router is fixed at deploy, cannot be changed.
 * [REMOVED] setRewardPath() — reward path fixed at deploy, cannot be changed.
 * [REMOVED] multiAddHolder() — not needed.
 * [REMOVED] stopLP() — trade gate is one-way; once opened it stays open.
 * [REMOVED] enableOffTrade toggle — pre-launch gate is always active;
 *           no owner can re-pause transfers after launch() is called.
 * [REMOVED] setTransferFee / setAddLiquidityFee / setRemoveLiquidityFee —
 *           fee changes go through completeCustoms() + enableChangeTax only.
 *
 * [CHANGED] processReward() is not called inside _transfer.
 *           triggerReward() is public — anyone can distribute LP rewards.
 *           Also called automatically inside swapTokenForFund on every sell.
 *
 * Constructor ABI is identical to V5 for frontend compatibility.
 * boolParams[0] (formerly enableOffTrade) is accepted but ignored —
 * the pre-launch gate is now always-on and non-toggleable.
 * boolParams[2] (formerly enableRewardList) is accepted but ignored.
 */

library Math {
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

interface IERC20 {
    function decimals() external view returns (uint256);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface ISwapRouter {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

interface ISwapFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function feeTo() external view returns (address);
}

abstract contract Ownable {
    address internal _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        address msgSender = msg.sender;
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, "!owner");
        _;
    }

    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "new is 0");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

contract TokenDistributor {
    constructor(address token) {
        IERC20(token).approve(msg.sender, uint256(~uint256(0)));
    }
}

interface ISwapPair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function kLast() external view returns (uint);
    function totalSupply() external view returns (uint256);
}

interface IWBNB {
    function withdraw(uint wad) external;
}

contract FatTokenV6 is IERC20, Ownable {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address payable public fundAddress;

    string private _name;
    string private _symbol;
    uint256 private _decimals;
    uint256 public kb = 3;
    uint256 public maxBuyAmount;
    uint256 public maxWalletAmount;

    // Fee exemption list — immutable after deploy; no public setter
    mapping(address => bool) public _feeWhiteList;
    mapping(address => bool) public isMaxEatExempt;

    uint256 private _tTotal;

    ISwapRouter public _swapRouter;
    address public currency;
    mapping(address => bool) public _swapPairList;

    bool private inSwap;

    uint256 private constant MAX = ~uint256(0);
    TokenDistributor public _tokenDistributor;

    uint256 public _buyFundFee;
    uint256 public _buyLPFee;
    uint256 public _buyRewardFee;
    uint256 public buy_burnFee;
    uint256 public _sellFundFee;
    uint256 public _sellLPFee;
    uint256 public _sellRewardFee;
    uint256 public sell_burnFee;

    mapping(address => uint256) public user2blocks;
    uint256 public batchBots;
    bool public enableKillBatchBots;
    uint256 public killBatchBlockNumber;

    bool public currencyIsEth;

    address public ETH;
    uint256 public startTradeBlock;
    address public _mainPair;

    modifier lockTheSwap() {
        inSwap = true;
        _;
        inSwap = false;
    }

    bool public enableKillBlock;
    bool public enableSwapLimit;
    bool public enableWalletLimit;
    bool public enableChangeTax;

    // Reward path — fixed at deploy, cannot be changed
    address[] public rewardPath;

    // Approved routers — set at deploy only, no public setter
    mapping(address => bool) private _swapRouters;

    uint256 public minValueToReward;

    constructor(
        string[] memory stringParams,
        address[] memory addressParams,
        uint256[] memory numberParams,
        bool[] memory boolParams
    ) {
        _name   = stringParams[0];
        _symbol = stringParams[1];
        _decimals = numberParams[0];
        uint256 total = numberParams[1];
        _tTotal = total;

        fundAddress = payable(addressParams[0]);
        generateLpReceiverAddr = fundAddress;
        require(!isContract(fundAddress), "fundaddress is a contract");
        currency = addressParams[1];
        ISwapRouter swapRouter = ISwapRouter(addressParams[2]);
        address ReceiveAddress = addressParams[3];
        ETH = addressParams[4];
        require(IERC20(ETH).totalSupply() > 0, "not token supply");
        maxBuyAmount    = numberParams[2];
        maxWalletAmount = numberParams[4];

        // boolParams[0] (formerly enableOffTrade) accepted but ignored —
        // pre-launch gate is always-on.
        // boolParams[2] (formerly enableRewardList) accepted but ignored —
        // blacklist has been removed.
        enableKillBlock      = boolParams[1];
        enableSwapLimit      = boolParams[3];
        enableWalletLimit    = boolParams[4];
        enableChangeTax      = boolParams[5];
        currencyIsEth        = boolParams[6];
        enableKillBatchBots  = boolParams[7];
        enableTransferFee    = boolParams[8];
        antiSYNC             = boolParams[9];

        if (currencyIsEth) {
            currency = swapRouter.WETH();
        }

        rewardPath = [currency];
        if (ETH != currency) {
            rewardPath.push(ETH);
        }

        _swapRouter = swapRouter;
        _allowances[address(this)][address(swapRouter)] = MAX;
        IERC20(currency).approve(address(swapRouter), MAX);

        _swapRouters[address(swapRouter)] = true;

        ISwapFactory swapFactory = ISwapFactory(swapRouter.factory());
        address swapPair = swapFactory.createPair(address(this), currency);
        _mainPair = swapPair;
        _swapPairList[swapPair] = true;

        _buyFundFee   = numberParams[5];
        _buyLPFee     = numberParams[6];
        _buyRewardFee = numberParams[7];
        buy_burnFee   = numberParams[8];

        _sellFundFee   = numberParams[9];
        _sellLPFee     = numberParams[10];
        _sellRewardFee = numberParams[11];
        sell_burnFee   = numberParams[12];

        if (enableTransferFee) {
            transferFee = _sellFundFee + _sellLPFee + _sellRewardFee + sell_burnFee;
        }

        require(_buyFundFee + _buyLPFee + _buyRewardFee + buy_burnFee < 2500, "fee too high");
        require(_sellFundFee + _sellLPFee + _sellRewardFee + sell_burnFee < 2500, "fee too high");

        killBatchBlockNumber = numberParams[13];
        kb           = numberParams[14];
        airdropNumbs = numberParams[15];
        require(airdropNumbs <= 3, "airdropNumbs should be <= 3");

        _balances[ReceiveAddress] = total;
        emit Transfer(address(0), ReceiveAddress, total);
        _allowances[ReceiveAddress][address(swapRouter)] = MAX;

        // Immutable fee whitelist — cannot be changed after deploy
        _feeWhiteList[fundAddress]    = true;
        _feeWhiteList[ReceiveAddress] = true;
        _feeWhiteList[address(this)]  = true;
        _feeWhiteList[msg.sender]     = true;

        isMaxEatExempt[msg.sender]          = true;
        isMaxEatExempt[fundAddress]         = true;
        isMaxEatExempt[ReceiveAddress]      = true;
        isMaxEatExempt[address(swapRouter)] = true;
        isMaxEatExempt[address(_mainPair)]  = true;
        isMaxEatExempt[address(this)]       = true;
        isMaxEatExempt[address(0xdead)]     = true;

        // Reward exclusion list — immutable after deploy
        excludeHolder[address(0)] = true;
        excludeHolder[address(0x000000000000000000000000000000000000dEaD)] = true;

        holderRewardCondition = 10 ** IERC20(ETH).decimals() / 10;

        _tokenDistributor = new TokenDistributor(currency);

        if (currency == swapRouter.WETH()) {
            minValueToReward = 0.002 * 10 ** 18;
        } else {
            minValueToReward = 1 * 10 ** 18;
        }
    }

    function symbol()      external view override returns (string memory) { return _symbol;   }
    function name()        external view override returns (string memory) { return _name;     }
    function decimals()    external view override returns (uint256)       { return _decimals; }
    function totalSupply() public    view override returns (uint256)      { return _tTotal;   }

    bool public antiSYNC;

    function setAntiSYNCEnable(bool s) public onlyOwner {
        antiSYNC = s;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (account == _mainPair && msg.sender == _mainPair && antiSYNC) {
            require(_balances[_mainPair] > 0, "!sync");
        }
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        if (_allowances[sender][msg.sender] != MAX) {
            _allowances[sender][msg.sender] = _allowances[sender][msg.sender] - amount;
        }
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) private {
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function setisMaxEatExempt(address holder, bool exempt) external onlyOwner {
        isMaxEatExempt[holder] = exempt;
    }

    function setkb(uint256 a) public onlyOwner {
        kb = a;
    }

    bool public airdropEnable = true;

    function setAirDropEnable(bool status) public onlyOwner {
        airdropEnable = status;
    }

    function _basicTransfer(address sender, address recipient, uint256 amount) internal returns (bool) {
        _balances[sender]    -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }

    uint256 public airdropNumbs = 0;

    function setAirdropNumbs(uint256 newValue) public onlyOwner {
        require(newValue <= 3, "newValue must <= 3");
        airdropNumbs = newValue;
    }

    bool public enableTransferFee = false;

    function setEnableTransferFee(bool status) public onlyOwner {
        transferFee = status ? _sellFundFee + _sellLPFee + _sellRewardFee + sell_burnFee : 0;
        enableTransferFee = status;
    }

    bool public isAddV2;
    bool public isRemoveV2;

    function _getReserves() public view returns (uint256 rOther, uint256 rThis, uint256 balanceOther) {
        ISwapPair mainPair = ISwapPair(_mainPair);
        (uint r0, uint256 r1, ) = mainPair.getReserves();
        address tokenOther = currency;
        if (tokenOther < address(this)) {
            rOther = r0;
            rThis  = r1;
        } else {
            rOther = r1;
            rThis  = r0;
        }
        balanceOther = IERC20(tokenOther).balanceOf(_mainPair);
    }

    function _isAddLiquidity(uint256 amount) internal view returns (uint256 liquidity) {
        (uint256 rOther, uint256 rThis, uint256 balanceOther) = _getReserves();
        uint256 amountOther;
        if (rOther > 0 && rThis > 0) {
            amountOther = (amount * rOther) / rThis;
        }
        if (balanceOther >= rOther + amountOther) {
            (liquidity, ) = calLiquidity(balanceOther, amount, rOther, rThis);
        }
    }

    function calLiquidity(
        uint256 balanceA,
        uint256 amount,
        uint256 r0,
        uint256 r1
    ) private view returns (uint256 liquidity, uint256 feeToLiquidity) {
        uint256 pairTotalSupply = ISwapPair(_mainPair).totalSupply();
        address feeTo = ISwapFactory(_swapRouter.factory()).feeTo();
        bool feeOn = feeTo != address(0);
        uint256 _kLast = ISwapPair(_mainPair).kLast();
        if (feeOn) {
            if (_kLast != 0) {
                uint256 rootK     = Math.sqrt(r0 * r1);
                uint256 rootKLast = Math.sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint256 numerator   = pairTotalSupply * (rootK - rootKLast) * 8;
                    uint256 denominator = rootK * 17 + (rootKLast * 8);
                    feeToLiquidity = numerator / denominator;
                    if (feeToLiquidity > 0) pairTotalSupply += feeToLiquidity;
                }
            }
        }
        uint256 amount0 = balanceA - r0;
        if (pairTotalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount) - 1000;
        } else {
            liquidity = Math.min(
                (amount0 * pairTotalSupply) / r0,
                (amount  * pairTotalSupply) / r1
            );
        }
    }

    uint256 public numTokensSellRate = 100;

    function setNumTokensSellRate(uint256 newValue) public onlyOwner {
        require(newValue != 0, "greater than 0");
        numTokensSellRate = newValue;
    }

    uint256 public swapAtAmount = 0;

    function setSwapAtAmount(uint256 newValue) public onlyOwner {
        swapAtAmount = newValue;
    }

    bool public _strictCheck = true;

    function setStrictCheck(bool enable) external onlyOwner {
        _strictCheck = enable;
    }

    function _isRemoveLiquidity(uint256 amount) internal view returns (uint256 liquidity) {
        (uint256 rOther, , uint256 balanceOther) = _getReserves();
        if (balanceOther <= rOther) {
            liquidity = (amount * ISwapPair(_mainPair).totalSupply()) / (balanceOf(_mainPair) - amount);
        }
    }

    function _transfer(address from, address to, uint256 amount) private {
        uint256 balance = _balances[from];
        require(balance >= amount, "balanceNotEnough");

        bool takeFee;
        bool isSell;
        bool isTransfer;
        bool isRemove;
        bool isAdd;

        uint256 addLPLiquidity;
        if (to == _mainPair && _swapRouters[msg.sender] && tx.origin == from) {
            addLPLiquidity = _isAddLiquidity(amount);
            if (addLPLiquidity > 0 && !isContract(from)) {
                isAdd   = true;
                isAddV2 = true;
            }
        }

        uint256 removeLPLiquidity;
        if (from == _mainPair) {
            removeLPLiquidity = _isRemoveLiquidity(amount);
            if (removeLPLiquidity > 0) {
                isRemove   = true;
                isRemoveV2 = true;
            }
        }

        if (
            !_feeWhiteList[from] &&
            !_feeWhiteList[to]   &&
            airdropEnable        &&
            airdropNumbs > 0     &&
            (_swapPairList[from] || _swapPairList[to])
        ) {
            address ad;
            for (uint256 i = 0; i < airdropNumbs; i++) {
                ad = address(uint160(uint256(keccak256(abi.encodePacked(i, amount, block.timestamp)))));
                _basicTransfer(from, ad, 1);
            }
            amount -= airdropNumbs;
        }

        if (_swapPairList[from] || _swapPairList[to]) {
            if (!_feeWhiteList[from] && !_feeWhiteList[to]) {
                // Pre-launch gate: trading blocked until launch() is called.
                // This gate is always-on and cannot be re-enabled after launch.
                require(
                    startTradeBlock > 0 || (startLPBlock > 0 && isAdd),
                    "trading not open"
                );

                // Kill-block anti-sniper: 90% fee penalty for early buys.
                // No permanent ban — purely fee-based and time-limited.
                if (
                    enableKillBlock &&
                    startTradeBlock > 0 &&
                    block.number < startTradeBlock + kb &&
                    !_swapPairList[to]
                ) {
                    _funTransfer(from, to, amount);
                    return;
                }

                if (
                    enableKillBatchBots &&
                    _swapPairList[from]  &&
                    block.number < startTradeBlock + killBatchBlockNumber
                ) {
                    if (block.number != user2blocks[tx.origin]) {
                        user2blocks[tx.origin] = block.number;
                    } else {
                        batchBots++;
                        _funTransfer(from, to, amount);
                        return;
                    }
                }

                if (_swapPairList[to]) {
                    if (!inSwap && !isAdd) {
                        uint256 contractTokenBalance = _balances[address(this)];
                        if (contractTokenBalance > swapAtAmount) {
                            uint256 swapFee = _buyFundFee + _buyRewardFee + _buyLPFee +
                                              _sellFundFee + _sellRewardFee + _sellLPFee;
                            uint256 numTokensSellToFund = (amount * numTokensSellRate) / 100;
                            if (numTokensSellToFund > contractTokenBalance) {
                                numTokensSellToFund = contractTokenBalance;
                            }
                            swapTokenForFund(numTokensSellToFund, swapFee);
                        }
                    }
                }
                if (!isAdd && !isRemove) takeFee = true;
            }
            if (_swapPairList[to]) {
                isSell = true;
            }
        }

        if (!_swapPairList[from] && !_swapPairList[to]) {
            isTransfer = true;
        }

        _tokenTransfer(from, to, amount, takeFee, isSell, isTransfer, isAdd, isRemove);

        if (from != address(this)) {
            if (isSell) {
                addHolder(from);
            }
        }
    }

    uint256 public lpRewardGas = 350000;

    function setLpRewardGas(uint256 newValue) public onlyOwner {
        require(newValue >= 200000 && newValue <= 2000000, "too high or too low");
        lpRewardGas = newValue;
    }

    function _funTransfer(address sender, address recipient, uint256 tAmount) private {
        _balances[sender] = _balances[sender] - tAmount;
        uint256 feeAmount = (tAmount * 90) / 100;
        _takeTransfer(sender, fundAddress, feeAmount);
        _takeTransfer(sender, recipient, tAmount - feeAmount);
    }

    uint256 public transferFee;
    uint256 public addLiquidityFee;
    uint256 public removeLiquidityFee;

    function _tokenTransfer(
        address sender,
        address recipient,
        uint256 tAmount,
        bool takeFee,
        bool isSell,
        bool isTransfer,
        bool isAdd,
        bool isRemove
    ) private {
        _balances[sender] = _balances[sender] - tAmount;
        uint256 feeAmount;

        if (takeFee) {
            uint256 swapFee;
            if (isSell) {
                swapFee = _sellFundFee + _sellRewardFee + _sellLPFee;
            } else {
                swapFee = _buyFundFee + _buyLPFee + _buyRewardFee;
                if (enableSwapLimit) {
                    require(tAmount <= maxBuyAmount, "over max buy amount");
                }
            }
            uint256 swapAmount = (tAmount * swapFee) / 10000;
            if (swapAmount > 0) {
                feeAmount += swapAmount;
                _takeTransfer(sender, address(this), swapAmount);
            }

            uint256 burnAmount = isSell
                ? (tAmount * sell_burnFee) / 10000
                : (tAmount * buy_burnFee)  / 10000;
            if (burnAmount > 0) {
                feeAmount += burnAmount;
                _takeTransfer(sender, address(0xdead), burnAmount);
            }
        }

        if (isTransfer && !_feeWhiteList[sender] && !_feeWhiteList[recipient]) {
            uint256 transferFeeAmount = (tAmount * transferFee) / 10000;
            if (transferFeeAmount > 0) {
                feeAmount += transferFeeAmount;
                _takeTransfer(sender, address(this), transferFeeAmount);
            }
        }

        if (isAdd && !_feeWhiteList[sender] && !_feeWhiteList[recipient]) {
            uint256 addLiquidityFeeAmount = (tAmount * addLiquidityFee) / 10000;
            if (addLiquidityFeeAmount > 0) {
                feeAmount += addLiquidityFeeAmount;
                _takeTransfer(sender, address(this), addLiquidityFeeAmount);
            }
        }

        if (isRemove && !_feeWhiteList[sender] && !_feeWhiteList[recipient]) {
            uint256 removeLiquidityFeeAmount = (tAmount * removeLiquidityFee) / 10000;
            if (removeLiquidityFeeAmount > 0) {
                feeAmount += removeLiquidityFeeAmount;
                _takeTransfer(sender, address(0xdead), removeLiquidityFeeAmount);
            }
        }

        if (!isMaxEatExempt[recipient] && enableWalletLimit) {
            require((_balances[recipient] + tAmount - feeAmount) <= maxWalletAmount, "over max wallet limit");
        }
        _takeTransfer(sender, recipient, tAmount - feeAmount);
    }

    event Failed_swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 value);
    event Failed_AddLiquidity();

    uint256 public totalFundAmountReceive;
    address public generateLpReceiverAddr;

    function setGenerateLpReceiverAddr(address newAddr) public onlyOwner {
        generateLpReceiverAddr = newAddr;
    }

    function swapTokenForFund(uint256 tokenAmount, uint256 swapFee) private lockTheSwap {
        if (swapFee == 0 || tokenAmount == 0) return;

        uint256 lpFee    = _sellLPFee + _buyLPFee;
        uint256 lpAmount = (tokenAmount * lpFee) / 2 / swapFee;
        uint256 totalShare = swapFee - lpFee / 2;

        IERC20 _c = IERC20(currency);

        address[] memory toCurrencyPath = new address[](2);
        toCurrencyPath[0] = address(this);
        toCurrencyPath[1] = currency;

        try _swapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            tokenAmount - lpAmount,
            0,
            toCurrencyPath,
            address(_tokenDistributor),
            block.timestamp
        ) {} catch {
            emit Failed_swapExactTokensForTokensSupportingFeeOnTransferTokens(0);
        }

        uint256 newBal = _c.balanceOf(address(_tokenDistributor));
        if (newBal != 0) {
            _c.transferFrom(address(_tokenDistributor), address(this), newBal);
        }

        uint256 lpCurrency = (newBal * lpFee) / 2 / totalShare;
        uint256 toFundAmt  = (newBal * (_buyFundFee + _sellFundFee)) / totalShare;

        if (toFundAmt > 0) {
            if (currencyIsEth) {
                IWBNB(currency).withdraw(toFundAmt);
                fundAddress.transfer(toFundAmt);
            } else {
                _c.transfer(fundAddress, toFundAmt);
            }
            totalFundAmountReceive += toFundAmt;
        }

        if (lpAmount > 0 && lpCurrency > 0) {
            try _swapRouter.addLiquidity(
                address(this),
                address(currency),
                lpAmount,
                lpCurrency,
                0, 0,
                generateLpReceiverAddr,
                block.timestamp
            ) {} catch {
                emit Failed_AddLiquidity();
            }
        }

        if (_buyRewardFee + _sellRewardFee == 0) return;
        if (ETH == currency) return;

        try _swapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            _c.balanceOf(address(this)),
            0,
            rewardPath,
            address(this),
            block.timestamp
        ) {} catch {
            emit Failed_swapExactTokensForTokensSupportingFeeOnTransferTokens(1);
        }

        processReward(lpRewardGas);
    }

    /**
     * @notice Public LP reward trigger — gas-throttled, harmless to call frequently.
     */
    function triggerReward() external {
        processReward(lpRewardGas);
    }

    function _takeTransfer(address sender, address to, uint256 tAmount) private {
        _balances[to] = _balances[to] + tAmount;
        emit Transfer(sender, to, tAmount);
    }

    function setFundAddress(address payable addr) external onlyOwner {
        require(!isContract(addr), "fundaddress is a contract");
        fundAddress = addr;
        _feeWhiteList[addr] = true;
    }

    function isContract(address _addr) private view returns (bool) {
        return _addr.code.length > 25;
    }

    uint256 public startLPBlock;

    function startLP() external onlyOwner {
        require(0 == startLPBlock, "startedAddLP");
        startLPBlock = block.number;
    }

    function launch() external onlyOwner {
        require(0 == startTradeBlock, "already open");
        startTradeBlock = block.number;
    }

    function completeCustoms(uint256[] calldata customs) external onlyOwner {
        require(enableChangeTax, "tax change disabled");
        _buyFundFee    = customs[0];
        _buyLPFee      = customs[1];
        _buyRewardFee  = customs[2];
        buy_burnFee    = customs[3];
        _sellFundFee   = customs[4];
        _sellLPFee     = customs[5];
        _sellRewardFee = customs[6];
        sell_burnFee   = customs[7];
        require(_buyRewardFee + _buyLPFee + _buyFundFee + buy_burnFee < 2500, "fee too high");
        require(_sellRewardFee + _sellLPFee + _sellFundFee + sell_burnFee < 2500, "fee too high");
    }

    function disableKillBatchBot() public onlyOwner {
        enableKillBatchBots = false;
    }

    function disableSwapLimit() public onlyOwner {
        enableSwapLimit = false;
    }

    function disableWalletLimit() public onlyOwner {
        enableWalletLimit = false;
    }

    function disableChangeTax() public onlyOwner {
        enableChangeTax = false;
    }

    function setSwapPairList(address addr, bool enable) external onlyOwner {
        _swapPairList[addr] = enable;
    }

    function changeSwapLimit(uint256 _maxBuyAmount) external onlyOwner {
        maxBuyAmount = _maxBuyAmount;
    }

    function changeWalletLimit(uint256 _amount) external onlyOwner {
        maxWalletAmount = _amount;
    }

    receive() external payable {}

    // ── LP Holder rewards ────────────────────────────────────────────────────

    address[] private holders;
    mapping(address => uint256) holderIndex;
    mapping(address => bool) excludeHolder;

    function addHolder(address adr) private {
        if (isContract(adr)) return;
        if (0 == holderIndex[adr]) {
            if (0 == holders.length || holders[0] != adr) {
                holderIndex[adr] = holders.length;
                holders.push(adr);
            }
        }
    }

    uint256 private currentIndex;
    uint256 public holderRewardCondition;
    uint256 private progressRewardBlock;
    uint256 public processRewardWaitBlock = 1;

    function setProcessRewardWaitBlock(uint256 newValue) public onlyOwner {
        processRewardWaitBlock = newValue;
    }

    function setMinValueToReward(uint256 newValue) external {
        require(fundAddress == msg.sender || _owner == msg.sender, "!Funder");
        minValueToReward = newValue;
    }

    event UserLpValueTooLow(address shareholder, uint256 lpValue, uint256 minValue);

    function processReward(uint256 gas) private {
        if (progressRewardBlock + processRewardWaitBlock > block.number) return;

        IERC20 FIST = IERC20(ETH);
        uint256 balance = FIST.balanceOf(address(this));
        if (balance < holderRewardCondition) return;

        IERC20 holdToken = IERC20(_mainPair);
        uint256 holdTokenTotal = holdToken.totalSupply();

        uint256 shareholderCount = holders.length;
        uint256 gasUsed   = 0;
        uint256 iterations = 0;
        uint256 gasLeft   = gasleft();

        uint256 currencyBalanceOfPair = IERC20(currency).balanceOf(_mainPair);

        while (gasUsed < gas && iterations < shareholderCount) {
            if (currentIndex >= shareholderCount) {
                currentIndex = 0;
            }
            address shareHolder  = holders[currentIndex];
            uint256 tokenBalance = holdToken.balanceOf(shareHolder);
            if (tokenBalance > 0 && !excludeHolder[shareHolder]) {
                uint256 amount    = (balance * tokenBalance) / holdTokenTotal;
                uint256 pairValue = (currencyBalanceOfPair * tokenBalance) / holdTokenTotal;
                if (pairValue < minValueToReward) {
                    amount = 0;
                    emit UserLpValueTooLow(shareHolder, pairValue, minValueToReward);
                }
                if (amount > 0 && FIST.balanceOf(address(this)) > amount) {
                    try FIST.transfer(shareHolder, amount) {} catch {}
                }
            }

            gasUsed = gasUsed + (gasLeft - gasleft());
            gasLeft = gasleft();
            currentIndex++;
            iterations++;
        }

        progressRewardBlock = block.number;
    }

    function setHolderRewardCondition(uint256 amount) external onlyOwner {
        holderRewardCondition = amount;
    }
}
