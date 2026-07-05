/**
 * FatFactory deployment script
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network bscTestnet
 *   npx hardhat run scripts/deploy.js --network bsc
 *   npx hardhat run scripts/deploy.js --network ethereum
 *
 * Env vars required (set in contracts-build/.env):
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   BSC_RPC=https://bsc-dataseed.binance.org
 *   BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
 *   ETHEREUM_RPC=https://eth.llamarpc.com
 */

const { ethers } = require("hardhat");

// Chainlink BNB/USD price feed addresses (8 decimals)
const PRICE_FEEDS = {
  bscTestnet: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526", // BNB/USD testnet
  bsc:        "0x0567F2323251f0Aab15c8DfB1967E4e8A7D42aeE", // BNB/USD mainnet
  ethereum:   "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH/USD mainnet
};

// PancakeSwap / Uniswap routers
const DEX_ROUTERS = {
  bscTestnet: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", // PancakeSwap testnet
  bsc:        "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap v2
  ethereum:   "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap v2
};

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying to: ${network}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer:     ${deployer.address}`);
  console.log(`Balance:      ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native\n`);

  const priceFeed = PRICE_FEEDS[network];
  const dexRouter = DEX_ROUTERS[network];
  if (!priceFeed || !dexRouter) throw new Error(`No config for network: ${network}`);

  // ── 1. Deploy implementation contracts ──────────────────────────────────────
  console.log("Deploying FatStandard implementation...");
  const FatStandard = await ethers.getContractFactory("FatStandard");
  const fatStandard = await FatStandard.deploy();
  await fatStandard.waitForDeployment();
  console.log(`  FatStandard:    ${await fatStandard.getAddress()}`);

  console.log("Deploying FatTax implementation...");
  const FatTax = await ethers.getContractFactory("FatTax");
  const fatTax = await FatTax.deploy();
  await fatTax.waitForDeployment();
  console.log(`  FatTax:         ${await fatTax.getAddress()}`);

  console.log("Deploying FatDeflationary implementation...");
  const FatDeflationary = await ethers.getContractFactory("FatDeflationary");
  const fatDeflationary = await FatDeflationary.deploy();
  await fatDeflationary.waitForDeployment();
  console.log(`  FatDeflationary:${await fatDeflationary.getAddress()}`);

  console.log("Deploying FatReflection implementation...");
  const FatReflection = await ethers.getContractFactory("FatReflection");
  const fatReflection = await FatReflection.deploy();
  await fatReflection.waitForDeployment();
  console.log(`  FatReflection:  ${await fatReflection.getAddress()}`);

  // ── 2. Deploy FatFactory ──────────────────────────────────────────────────
  console.log("\nDeploying FatFactory...");
  const FatFactory = await ethers.getContractFactory("FatFactory");
  const factory = await FatFactory.deploy(
    await fatStandard.getAddress(),
    await fatTax.getAddress(),
    await fatDeflationary.getAddress(),
    await fatReflection.getAddress(),
    dexRouter,
    priceFeed,
    ethers.parseEther("10"),  // $10 USD deployment fee
    3600,                     // 1-hour max price staleness
    deployer.address          // fee receiver (replace with treasury wallet)
  );
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log(`  FatFactory:     ${factoryAddr}`);

  // ── 3. Summary ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("DEPLOYMENT COMPLETE — add to src/lib/contracts.ts:");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`FACTORY_ADDRESSES:`);
  const chainIds = { bscTestnet: 97, bsc: 56, ethereum: 1 };
  console.log(`  ${chainIds[network]}: '${factoryAddr}',`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
