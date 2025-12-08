const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署所有合约到 Sepolia 测试网...\n");

  // 获取部署账户
  const [deployer, provider] = await ethers.getSigners();
  
  if (!provider) {
    console.log("警告: 只有一个签名者，将使用 deployer 作为 provider");
  }
  
  const providerAddress = provider ? provider.address : deployer.address;
  
  console.log("部署账户:", deployer.address);
  console.log("Provider 账户:", providerAddress);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.1")) {
    console.log("\n⚠️  警告: 账户余额较低，建议至少 0.5 ETH 用于部署");
    console.log("   从 Sepolia 水龙头获取测试 ETH:");
    console.log("   - https://sepoliafaucet.com/");
    console.log("   - https://www.alchemy.com/faucets/ethereum-sepolia");
    console.log("");
  }

  // ============ 1. 部署 MockERC20 (USDT) ============
  console.log("\n1. 部署 MockERC20 (USDT)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
  await paymentToken.waitForDeployment();
  const paymentTokenAddress = await paymentToken.getAddress();
  console.log("   ✓ MockERC20 (USDT) 部署地址:", paymentTokenAddress);

  // ============ 2. 部署 CollateralVault ============
  console.log("\n2. 部署 CollateralVault...");
  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const collateralVault = await CollateralVault.deploy(paymentTokenAddress);
  await collateralVault.waitForDeployment();
  const collateralVaultAddress = await collateralVault.getAddress();
  console.log("   ✓ CollateralVault 部署地址:", collateralVaultAddress);

  // ============ 3. 部署 RevenueManager ============
  console.log("\n3. 部署 RevenueManager...");
  const RevenueManager = await ethers.getContractFactory("RevenueManager");
  const revenueManager = await RevenueManager.deploy();
  await revenueManager.waitForDeployment();
  const revenueManagerAddress = await revenueManager.getAddress();
  console.log("   ✓ RevenueManager 部署地址:", revenueManagerAddress);
  
  // 设置时间单位为 DAY (2)
  console.log("   配置 RevenueManager...");
  await (await revenueManager.setUnitSeconds(2)).wait();
  console.log("   ✓ 设置时间单位: DAY");
  
  await (await revenueManager.setCollateralVault(collateralVaultAddress)).wait();
  console.log("   ✓ 设置 CollateralVault");

  // ============ 4. 部署 LiquidateManager ============
  console.log("\n4. 部署 LiquidateManager...");
  const LiquidateManager = await ethers.getContractFactory("LiquidateManager");
  const liquidateManager = await LiquidateManager.deploy();
  await liquidateManager.waitForDeployment();
  const liquidateManagerAddress = await liquidateManager.getAddress();
  console.log("   ✓ LiquidateManager 部署地址:", liquidateManagerAddress);

  // 配置 LiquidateManager
  console.log("   配置 LiquidateManager...");
  const QUARTERLY_EXPECTED_DIVIDEND = ethers.parseUnits("10000", 6);
  const QUARTER_CYCLE_DAYS = 90; // Sepolia 上使用真实的 90 天
  await (await liquidateManager.setQuarterlyExpectedDividend(QUARTERLY_EXPECTED_DIVIDEND)).wait();
  await (await liquidateManager.setQuarterCycleDays(QUARTER_CYCLE_DAYS)).wait();
  await (await liquidateManager.setRevenueManager(revenueManagerAddress)).wait();
  await (await liquidateManager.setCollateralVault(collateralVaultAddress)).wait();
  console.log("   ✓ LiquidateManager 配置完成");

  // ============ 5. 部署 OrderBook ============
  console.log("\n5. 部署 OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const feeCollector = deployer.address;
  const feeRate = 50; // 0.5%
  const orderBook = await OrderBook.deploy(feeCollector, feeRate);
  await orderBook.waitForDeployment();
  const orderBookAddress = await orderBook.getAddress();
  console.log("   ✓ OrderBook 部署地址:", orderBookAddress);

  // ============ 6. 部署 AssetToken ============
  console.log("\n6. 部署 AssetToken...");
  const AssetToken = await ethers.getContractFactory("AssetToken");
  const assetToken = await AssetToken.deploy();
  await assetToken.waitForDeployment();
  const assetTokenAddress = await assetToken.getAddress();
  console.log("   ✓ AssetToken 部署地址:", assetTokenAddress);

  // 初始化 AssetToken
  console.log("   初始化 AssetToken...");
  const metadata = {
    name: "Real Estate Token Sepolia",
    symbol: "RETS",
    totalValue: ethers.parseUnits("1000000", 6),
    fundraiseAmount: ethers.parseUnits("500000", 6),
    maxTotalSupply: ethers.parseUnits("1000000", 18),
    specialPurposeVehicle: deployer.address,
    provider: providerAddress,
    createdAt: Math.floor(Date.now() / 1000)
  };

  await (await assetToken.initialize(
    metadata,
    paymentTokenAddress,
    collateralVaultAddress,
    revenueManagerAddress
  )).wait();
  console.log("   ✓ AssetToken 初始化完成");

  await (await assetToken.setLiquidateManager(liquidateManagerAddress)).wait();
  console.log("   ✓ 设置 LiquidateManager");

  await (await assetToken.setOrderBook(orderBookAddress)).wait();
  await (await orderBook.setAssetToken(assetTokenAddress)).wait();
  console.log("   ✓ 设置 OrderBook");

  // ============ 部署总结 ============
  console.log("\n" + "=".repeat(70));
  console.log("部署完成! Sepolia 测试网合约地址:");
  console.log("=".repeat(70));
  console.log("MockERC20 (USDT):    ", paymentTokenAddress);
  console.log("CollateralVault:     ", collateralVaultAddress);
  console.log("RevenueManager:      ", revenueManagerAddress);
  console.log("LiquidateManager:    ", liquidateManagerAddress);
  console.log("OrderBook:           ", orderBookAddress);
  console.log("AssetToken:          ", assetTokenAddress);
  console.log("=".repeat(70));

  // 保存部署信息
  const deploymentInfo = {
    network: "sepolia",
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    contracts: {
      MockERC20: paymentTokenAddress,
      CollateralVault: collateralVaultAddress,
      RevenueManager: revenueManagerAddress,
      LiquidateManager: liquidateManagerAddress,
      OrderBook: orderBookAddress,
      AssetToken: assetTokenAddress
    },
    accounts: {
      deployer: deployer.address,
      provider: providerAddress
    },
    assetInfo: {
      name: metadata.name,
      symbol: metadata.symbol,
      totalValue: ethers.formatUnits(metadata.totalValue, 6),
      fundraiseAmount: ethers.formatUnits(metadata.fundraiseAmount, 6),
      maxTotalSupply: ethers.formatUnits(metadata.maxTotalSupply, 18)
    }
  };

  const fs = require('fs');
  fs.writeFileSync(
    './deployment-info-sepolia.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n✓ 部署信息已保存到 deployment-info-sepolia.json");

  console.log("\n📝 下一步:");
  console.log("1. 验证合约:");
  console.log("   npx hardhat verify --network sepolia", assetTokenAddress);
  console.log("\n2. 在 Etherscan 查看:");
  console.log("   https://sepolia.etherscan.io/address/" + assetTokenAddress);
  console.log("\n3. 更新前端配置 (frontend/.env.local)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

