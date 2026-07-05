// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./StandardTokenImplementation.sol";
import "./TaxTokenImplementation.sol";
import "./DeflationaryTokenImplementation.sol";
import "./ReflectionTokenImplementation.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/**
 * @title TokenFactory
 * @dev Factory for deploying 4 types of highly configurable ERC-20 tokens using EIP-1167 minimal proxy pattern
 *
 * Token Types:
 * 1. Standard - Clean ERC-20 with no automatic fees
 * 2. Tax - Configurable tax on transfers/buys/sells distributed to multiple wallets
 * 3. Deflationary - Configurable burn on transfers/buys/sells
 * 4. Reflection - Configurable RFI-style reflection on transfers/buys/sells
 *
 * Builder Freedom:
 * - Choose which transfer types to tax/deflate/reflect (transfers, buys, sells, or any combination)
 * - Set different rates for each type (e.g., 2% transfer, 5% buy, 10% sell)
 * - Choose ANY combination of tax destinations (1-5 or any mix)
 * - DEX pair management for buy/sell detection
 *
 * Gas Savings: 80-90% cheaper than deploying full contracts
 * Monetization: Dynamic USD-based deployment fee via Chainlink price feed
 */
contract TokenFactory is Ownable, ReentrancyGuard {

    // ============================================
    // STATE VARIABLES
    // ============================================

    enum TokenType { STANDARD, TAX, DEFLATIONARY, REFLECTION }

    struct ImplementationAddresses {
        address standard;
        address tax;
        address deflationary;
        address reflection;
    }

    ImplementationAddresses public implementations;

    address public dexRouter; // DEX router for all token deployments

    AggregatorV3Interface public priceFeed; // Chainlink native/USD price feed
    uint8 public feedDecimals;             // Cached decimals from price feed
    uint256 public feeInUSD;               // Fee in USD with 18 decimals (e.g. 50e18 = $50)
    uint256 public maxStaleness;           // Max age of price data in seconds (e.g. 3600 = 1 hour)

    uint256 public constant MIN_STALENESS = 60;       // 1 minute minimum
    uint256 public constant MAX_STALENESS_CAP = 86400; // 24 hours maximum
    uint256 public constant MAX_FEE_USD = 1000e18;      // $1,000 sanity cap

    address public feeReceiver;
    uint256 public totalDeployed;

    mapping(address => address[]) public deployerTokens;
    mapping(address => bool) public isFactoryToken;
    mapping(address => TokenType) public tokenTypes;

    // ============================================
    // EVENTS
    // ============================================

    event TokenCreated(
        address indexed tokenAddress,
        address indexed deployer,
        TokenType indexed tokenType,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 timestamp
    );

    event FeeInUSDUpdated(uint256 oldFee, uint256 newFee);
    event PriceFeedUpdated(address indexed oldFeed, address indexed newFeed);
    event MaxStalenessUpdated(uint256 oldStaleness, uint256 newStaleness);
    event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event FeesWithdrawn(address indexed receiver, uint256 amount);
    event ImplementationUpdated(TokenType indexed tokenType, address newImplementation);
    event DexRouterUpdated(address indexed oldRouter, address indexed newRouter);

    // ============================================
    // ERRORS
    // ============================================

    error InsufficientDeploymentFee(uint256 provided, uint256 required);
    error InvalidFeeReceiver();
    error InvalidImplementation();
    error TokenInitializationFailed();
    error NoFeesToWithdraw();
    error FeeTransferFailed();
    error InvalidTokenType();
    error InvalidPriceFeed();
    error StalePrice(uint256 updatedAt, uint256 threshold);
    error IncompleteRound(uint80 roundId, uint80 answeredInRound);
    error InvalidPrice();
    error StalenessOutOfRange(uint256 value, uint256 min, uint256 max);
    error FeeExceedsCap(uint256 fee, uint256 cap);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address standardImpl_,
        address taxImpl_,
        address deflationaryImpl_,
        address reflectionImpl_,
        address dexRouter_,
        address priceFeed_,
        uint256 feeInUSD_,
        uint256 maxStaleness_,
        address feeReceiver_
    ) Ownable(msg.sender) {
        if (standardImpl_ == address(0) || taxImpl_ == address(0) ||
            deflationaryImpl_ == address(0) || reflectionImpl_ == address(0)) {
            revert InvalidImplementation();
        }
        if (feeReceiver_ == address(0)) revert InvalidFeeReceiver();
        if (dexRouter_ == address(0)) revert InvalidImplementation();
        if (priceFeed_ == address(0)) revert InvalidPriceFeed();
        if (maxStaleness_ < MIN_STALENESS || maxStaleness_ > MAX_STALENESS_CAP) {
            revert StalenessOutOfRange(maxStaleness_, MIN_STALENESS, MAX_STALENESS_CAP);
        }
        if (feeInUSD_ > MAX_FEE_USD) revert FeeExceedsCap(feeInUSD_, MAX_FEE_USD);

        implementations.standard = standardImpl_;
        implementations.tax = taxImpl_;
        implementations.deflationary = deflationaryImpl_;
        implementations.reflection = reflectionImpl_;
        dexRouter = dexRouter_;
        priceFeed = AggregatorV3Interface(priceFeed_);
        feedDecimals = AggregatorV3Interface(priceFeed_).decimals();
        feeInUSD = feeInUSD_;
        maxStaleness = maxStaleness_;
        feeReceiver = feeReceiver_;
    }

    // ============================================
    // CREATE STANDARD TOKEN
    // ============================================

    function createStandardToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply
    ) external payable nonReentrant returns (address) {
        uint256 requiredFee = getDeploymentFee();
        if (msg.value < requiredFee) {
            revert InsufficientDeploymentFee(msg.value, requiredFee);
        }

        address tokenAddress = Clones.clone(implementations.standard);

        try StandardTokenImplementation(tokenAddress).initialize(
            name, symbol, decimals, totalSupply, msg.sender
        ) {} catch {
            revert TokenInitializationFailed();
        }

        _recordDeployment(tokenAddress, TokenType.STANDARD, name, symbol, totalSupply);
        _refundExcess(requiredFee);

        return tokenAddress;
    }

    // ============================================
    // CREATE TAX TOKEN
    // ============================================

    function createTaxToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        TaxTokenImplementation.TaxBehavior memory taxBehavior,
        TaxTokenImplementation.TaxDistribution memory taxDistribution
    ) external payable nonReentrant returns (address) {
        uint256 requiredFee = getDeploymentFee();
        if (msg.value < requiredFee) {
            revert InsufficientDeploymentFee(msg.value, requiredFee);
        }

        address payable tokenAddress = payable(Clones.clone(implementations.tax));

        try TaxTokenImplementation(tokenAddress).initialize(
            name, symbol, decimals, totalSupply, msg.sender, taxBehavior, taxDistribution, dexRouter
        ) {} catch {
            revert TokenInitializationFailed();
        }

        _recordDeployment(tokenAddress, TokenType.TAX, name, symbol, totalSupply);
        _refundExcess(requiredFee);

        return tokenAddress;
    }

    // ============================================
    // CREATE DEFLATIONARY TOKEN
    // ============================================

    function createDeflationaryToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        DeflationaryTokenImplementation.TaxBehavior memory taxBehavior,
        DeflationaryTokenImplementation.TaxDistribution memory taxDistribution
    ) external payable nonReentrant returns (address) {
        uint256 requiredFee = getDeploymentFee();
        if (msg.value < requiredFee) {
            revert InsufficientDeploymentFee(msg.value, requiredFee);
        }

        address payable tokenAddress = payable(Clones.clone(implementations.deflationary));

        try DeflationaryTokenImplementation(tokenAddress).initialize(
            name, symbol, decimals, totalSupply, msg.sender, taxBehavior, taxDistribution, dexRouter            
        ) {} catch {
            revert TokenInitializationFailed();
        }

        _recordDeployment(tokenAddress, TokenType.DEFLATIONARY, name, symbol, totalSupply);
        _refundExcess(requiredFee);

        return tokenAddress;
    }

    // ============================================
    // CREATE REFLECTION TOKEN
    // ============================================

    function createReflectionToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        ReflectionTokenImplementation.TaxBehavior memory taxBehavior,
        ReflectionTokenImplementation.TaxDistribution memory taxDistribution
    ) external payable nonReentrant returns (address) {
        uint256 requiredFee = getDeploymentFee();
        if (msg.value < requiredFee) {
            revert InsufficientDeploymentFee(msg.value, requiredFee);
        }

        address payable tokenAddress = payable(Clones.clone(implementations.reflection));

        try ReflectionTokenImplementation(tokenAddress).initialize(
            name, symbol, decimals, totalSupply, msg.sender, taxBehavior, taxDistribution, dexRouter            
        ) {} catch {
            revert TokenInitializationFailed();
        }

        _recordDeployment(tokenAddress, TokenType.REFLECTION, name, symbol, totalSupply);
        _refundExcess(requiredFee);

        return tokenAddress;
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    function _recordDeployment(
        address tokenAddress,
        TokenType tokenType,
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) private {
        totalDeployed++;
        deployerTokens[msg.sender].push(tokenAddress);
        isFactoryToken[tokenAddress] = true;
        tokenTypes[tokenAddress] = tokenType;

        emit TokenCreated(
            tokenAddress,
            msg.sender,
            tokenType,
            name,
            symbol,
            totalSupply,
            block.timestamp
        );
    }

    function _refundExcess(uint256 fee) private {
        if (msg.value > fee) {
            (bool success, ) = msg.sender.call{value: msg.value - fee}("");
            if (!success) {} // Intentionally ignore refund failures
        }
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getDeployerTokens(address deployer) external view returns (address[] memory) {
        return deployerTokens[deployer];
    }

    function getDeployerTokenCount(address deployer) external view returns (uint256) {
        return deployerTokens[deployer].length;
    }

    function isFromFactory(address tokenAddress) external view returns (bool) {
        return isFactoryToken[tokenAddress];
    }

    function getTokenType(address tokenAddress) external view returns (TokenType) {
        if (!isFactoryToken[tokenAddress]) revert InvalidTokenType();
        return tokenTypes[tokenAddress];
    }

    function getDeploymentFee() public view returns (uint256) {
        if (feeInUSD == 0) return 0;

        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        if (price <= 0) revert InvalidPrice();
        if (answeredInRound < roundId) revert IncompleteRound(roundId, answeredInRound);
        if (block.timestamp - updatedAt > maxStaleness) {
            revert StalePrice(updatedAt, maxStaleness);
        }

        // feeInUSD is 18 decimals, price is feedDecimals (typically 8), result in wei (18 decimals)
        return (feeInUSD * (10 ** feedDecimals)) / uint256(price);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getImplementations() external view returns (ImplementationAddresses memory) {
        return implementations;
    }

    // ============================================
    // OWNER FUNCTIONS
    // ============================================

    function setFeeInUSD(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE_USD) revert FeeExceedsCap(newFee, MAX_FEE_USD);
        uint256 oldFee = feeInUSD;
        feeInUSD = newFee;
        emit FeeInUSDUpdated(oldFee, newFee);
    }

    function setPriceFeed(address newFeed) external onlyOwner {
        if (newFeed == address(0)) revert InvalidPriceFeed();
        address oldFeed = address(priceFeed);
        priceFeed = AggregatorV3Interface(newFeed);
        feedDecimals = AggregatorV3Interface(newFeed).decimals();
        emit PriceFeedUpdated(oldFeed, newFeed);
    }

    function setMaxStaleness(uint256 newStaleness) external onlyOwner {
        if (newStaleness < MIN_STALENESS || newStaleness > MAX_STALENESS_CAP) {
            revert StalenessOutOfRange(newStaleness, MIN_STALENESS, MAX_STALENESS_CAP);
        }
        uint256 oldStaleness = maxStaleness;
        maxStaleness = newStaleness;
        emit MaxStalenessUpdated(oldStaleness, newStaleness);
    }

    function setFeeReceiver(address newReceiver) external onlyOwner {
        if (newReceiver == address(0)) revert InvalidFeeReceiver();
        address oldReceiver = feeReceiver;
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(oldReceiver, newReceiver);
    }

    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFeesToWithdraw();

        (bool success, ) = feeReceiver.call{value: balance}("");
        if (!success) revert FeeTransferFailed();

        emit FeesWithdrawn(feeReceiver, balance);
    }

    function updateImplementation(TokenType tokenType, address newImplementation) external onlyOwner {
        if (newImplementation == address(0)) revert InvalidImplementation();

        if (tokenType == TokenType.STANDARD) {
            implementations.standard = newImplementation;
        } else if (tokenType == TokenType.TAX) {
            implementations.tax = newImplementation;
        } else if (tokenType == TokenType.DEFLATIONARY) {
            implementations.deflationary = newImplementation;
        } else if (tokenType == TokenType.REFLECTION) {
            implementations.reflection = newImplementation;
        } else {
            revert InvalidTokenType();
        }

        emit ImplementationUpdated(tokenType, newImplementation);
    }

    function setDexRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert InvalidImplementation();
        address oldRouter = dexRouter;
        dexRouter = newRouter;
        emit DexRouterUpdated(oldRouter, newRouter);
    }

    function recoverERC20(address tokenAddress, uint256 amount) external onlyOwner {
        (bool success, bytes memory data) = tokenAddress.call(
            abi.encodeWithSignature("transfer(address,uint256)", owner(), amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Token recovery failed");
    }

    receive() external payable {}
}
