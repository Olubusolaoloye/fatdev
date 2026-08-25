const hre = require("hardhat");

const DEAD = "0x000000000000000000000000000000000000dEaD";
const ZERO = "0x0000000000000000000000000000000000000000";

async function testContract(name, deployFn) {
  try {
    const result = await deployFn();
    console.log(`✅ ${name}: OK`);
    return result;
  } catch (e) {
    console.error(`❌ ${name}: FAILED — ${e.message.slice(0, 200)}`);
    return null;
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("---");

  const supply = 1000000000n * 10n**18n;
  const taxBehavior = {
    taxOnTransfer: false, taxOnBuy: true, taxOnSell: true,
    transferTax: 0n, buyTax: 500n, sellTax: 500n,
  };
  const taxDist = {
    marketingPercent: 6000n, liquidityPercent: 2000n,
    teamPercent: 1000n, buybackPercent: 0n, burnPercent: 1000n,
    marketingWallet: DEAD, teamWallet: DEAD, buybackWallet: DEAD,
  };
  const reflDist = {
    reflectionPercent: 6000n, marketingPercent: 2000n,
    liquidityPercent: 2000n, teamPercent: 0n, buybackPercent: 0n,
    marketingWallet: DEAD, teamWallet: ZERO, buybackWallet: ZERO,
  };

  // FatStandard
  await testContract("FatStandard deploy+init", async () => {
    const F = await hre.ethers.getContractFactory("FatStandard");
    const c = await F.deploy(); await c.waitForDeployment();
    const tx = await c.initialize("TestStd","TSTD",18,supply,deployer.address);
    await tx.wait();
    const n = await c.name(); const s = await c.totalSupply();
    console.log(`  name=${n} supply=${s}`);
  });

  // FatTax
  await testContract("FatTax deploy+init", async () => {
    const F = await hre.ethers.getContractFactory("FatTax");
    const c = await F.deploy(); await c.waitForDeployment();
    const tx = await c.initialize("TestTax","TTAX",18,supply,deployer.address,taxBehavior,taxDist,DEAD);
    await tx.wait();
    const n = await c.name(); const s = await c.totalSupply();
    console.log(`  name=${n} supply=${s}`);
  });

  // FatDeflationary — uses deflationPercent not burnPercent
  const defDist = {
    marketingPercent: 2000n, liquidityPercent: 2000n,
    teamPercent: 0n, buybackPercent: 0n, deflationPercent: 6000n,
    marketingWallet: DEAD, teamWallet: ZERO, buybackWallet: ZERO,
  };
  await testContract("FatDeflationary deploy+init", async () => {
    const F = await hre.ethers.getContractFactory("FatDeflationary");
    const c = await F.deploy(); await c.waitForDeployment();
    const tx = await c.initialize("TestDef","TDEF",18,supply,deployer.address,taxBehavior,defDist,DEAD);
    await tx.wait();
    const n = await c.name(); const s = await c.totalSupply();
    console.log(`  name=${n} supply=${s}`);
  });

  // FatReflection
  await testContract("FatReflection deploy+init", async () => {
    const F = await hre.ethers.getContractFactory("FatReflection");
    const c = await F.deploy(); await c.waitForDeployment();
    const tx = await c.initialize("TestRef","TREF",18,supply,deployer.address,taxBehavior,reflDist,DEAD);
    await tx.wait();
    const n = await c.name(); const s = await c.totalSupply();
    console.log(`  name=${n} supply=${s}`);
  });

  // Test double-init prevention
  await testContract("AlreadyInitialized guard", async () => {
    const F = await hre.ethers.getContractFactory("FatStandard");
    const c = await F.deploy(); await c.waitForDeployment();
    await (await c.initialize("A","A",18,supply,deployer.address)).wait();
    // Second call should revert
    try {
      await c.initialize("B","B",18,supply,deployer.address);
      throw new Error("Should have reverted!");
    } catch(e) {
      if (e.message.includes("AlreadyInitialized")) { console.log("  Double-init correctly blocked"); return; }
      throw e;
    }
  });
}

main().then(()=>process.exit(0)).catch(e=>{console.error("Fatal:",e.message);process.exit(1)});
