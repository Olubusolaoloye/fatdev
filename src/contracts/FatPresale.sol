// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

interface IUniswapV2Router {
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256, uint256, uint256);
}

/**
 * @title FatPresale
 * @notice Lightweight presale/fairlaunch contract.
 *         Owner deploys, funds with tokens, sets caps & price.
 *         On finalise: adds liquidity automatically, distributes tokens to contributors.
 *         On soft-cap failure: full refund available.
 */
contract FatPresale {

    /* ─────────────────────────────────────────────────── state ── */

    address public owner;
    address public token;
    address public router;

    uint256 public hardCap;       // max ETH raised (wei)
    uint256 public softCap;       // min ETH for success (wei)
    uint256 public tokensPerEth;  // sale tokens per 1 ETH (in token's smallest unit × 1e18 factor)
    uint256 public startTime;
    uint256 public endTime;
    uint256 public liquidityPct;  // % of raised ETH added as LP (30-100)
    bool    public whitelistOnly;

    bool    public finalized;
    bool    public cancelled;
    uint256 public totalRaised;

    mapping(address => uint256) public contributions;
    mapping(address => bool)    public whitelist;
    mapping(address => bool)    public claimed;

    /* ─────────────────────────────────────────────── events ── */

    event Contributed(address indexed buyer, uint256 ethAmount);
    event Finalized(uint256 totalRaised, uint256 ethAddedToLP);
    event Claimed(address indexed buyer, uint256 tokens);
    event Refunded(address indexed buyer, uint256 ethAmount);
    event Cancelled();

    /* ──────────────────────────────────────────── constructor ── */

    constructor(
        address token_,
        address router_,
        uint256 hardCap_,
        uint256 softCap_,
        uint256 tokensPerEth_,
        uint256 startTime_,
        uint256 endTime_,
        uint256 liquidityPct_,
        bool    whitelistOnly_
    ) {
        require(softCap_      <= hardCap_,  "soft > hard");
        require(endTime_      >  startTime_, "bad window");
        require(liquidityPct_ >= 30 && liquidityPct_ <= 100, "liq 30-100");
        require(tokensPerEth_ > 0, "bad price");

        owner         = msg.sender;
        token         = token_;
        router        = router_;
        hardCap       = hardCap_;
        softCap       = softCap_;
        tokensPerEth  = tokensPerEth_;
        startTime     = startTime_;
        endTime       = endTime_;
        liquidityPct  = liquidityPct_;
        whitelistOnly = whitelistOnly_;
    }

    /* ─────────────────────────────────────────────── modifiers ── */

    modifier onlyOwner()    { require(msg.sender == owner,            "not owner");  _; }
    modifier notEnded()     { require(!finalized && !cancelled,       "ended");      _; }
    modifier presaleOpen()  {
        require(block.timestamp >= startTime, "not started");
        require(block.timestamp <= endTime,   "ended");
        _;
    }

    /* ──────────────────────────────────────────── whitelist ── */

    function addToWhitelist(address[] calldata addrs) external onlyOwner {
        for (uint256 i; i < addrs.length; ++i) whitelist[addrs[i]] = true;
    }

    function removeFromWhitelist(address[] calldata addrs) external onlyOwner {
        for (uint256 i; i < addrs.length; ++i) whitelist[addrs[i]] = false;
    }

    /* ──────────────────────────────────────────── contribute ── */

    function contribute() external payable notEnded presaleOpen {
        require(msg.value > 0, "zero ETH");
        if (whitelistOnly) require(whitelist[msg.sender], "not whitelisted");
        require(totalRaised + msg.value <= hardCap, "exceeds hard cap");

        contributions[msg.sender] += msg.value;
        totalRaised               += msg.value;
        emit Contributed(msg.sender, msg.value);
    }

    /* ──────────────────────────────────────────── finalize ── */

    function finalize() external onlyOwner notEnded {
        require(
            block.timestamp > endTime || totalRaised >= hardCap,
            "presale still running"
        );
        require(totalRaised >= softCap, "soft cap not met, use cancel()");

        finalized = true;

        uint256 ethForLP   = totalRaised * liquidityPct / 100;
        uint256 tokenBal   = IERC20(token).balanceOf(address(this));

        // tokens owed to contributors
        uint256 tokensSold = totalRaised * tokensPerEth / 1 ether;
        // tokens for LP (priced at the same ratio)
        uint256 tokensForLP = ethForLP * tokensPerEth / 1 ether;

        require(tokenBal >= tokensSold + tokensForLP, "fund contract with tokens first");

        // Add liquidity — LP NFT/tokens sent to owner
        IERC20(token).approve(router, tokensForLP);
        IUniswapV2Router(router).addLiquidityETH{value: ethForLP}(
            token,
            tokensForLP,
            0, 0,
            owner,
            block.timestamp + 600
        );

        // Remaining ETH → owner (dev allocation)
        uint256 ethRemaining = address(this).balance;
        if (ethRemaining > 0) payable(owner).transfer(ethRemaining);

        emit Finalized(totalRaised, ethForLP);
    }

    /* ──────────────────────────────────────────── claim ── */

    function claim() external {
        require(finalized, "not finalized yet");
        require(contributions[msg.sender] > 0, "no contribution");
        require(!claimed[msg.sender],           "already claimed");

        claimed[msg.sender] = true;
        uint256 tokens = contributions[msg.sender] * tokensPerEth / 1 ether;
        require(IERC20(token).transfer(msg.sender, tokens), "transfer failed");
        emit Claimed(msg.sender, tokens);
    }

    /* ──────────────────────────────────────────── refund ── */

    function refund() external {
        bool softCapFailed = block.timestamp > endTime && totalRaised < softCap;
        require(cancelled || softCapFailed, "not refundable");

        uint256 owed = contributions[msg.sender];
        require(owed > 0, "nothing to refund");
        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(owed);
        emit Refunded(msg.sender, owed);
    }

    /* ──────────────────────────────────────────── cancel ── */

    function cancel() external onlyOwner notEnded {
        cancelled = true;
        // return unsold tokens to owner
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
        emit Cancelled();
    }

    /* ─────────────────────────────────────────── view helpers ── */

    function presaleStatus() external view returns (
        string memory status,
        uint256 raised,
        uint256 hard,
        uint256 soft,
        uint256 endsAt,
        bool    isFinalized,
        bool    isCancelled
    ) {
        if (cancelled)  return ("CANCELLED",  totalRaised, hardCap, softCap, endTime, false, true);
        if (finalized)  return ("FINALIZED",  totalRaised, hardCap, softCap, endTime, true,  false);
        if (block.timestamp < startTime) return ("UPCOMING", totalRaised, hardCap, softCap, endTime, false, false);
        if (block.timestamp > endTime)   return ("ENDED",    totalRaised, hardCap, softCap, endTime, false, false);
        return ("LIVE", totalRaised, hardCap, softCap, endTime, false, false);
    }

    function tokensForContributor(address addr) external view returns (uint256) {
        return contributions[addr] * tokensPerEth / 1 ether;
    }

    receive() external payable { revert("call contribute()"); }
}
