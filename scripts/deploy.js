const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署所有合约...\n");

  // 获取部署账户
  const [deployer, provider, user1, user2, user3] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============ 1. 部署 MockERC20 (USDT) ============
  console.log("1. 部署 MockERC20 (USDT)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
  await paymentToken.waitForDeployment();
  const paymentTokenAddress = await paymentToken.getAddress();
  console.log("   MockERC20 (USDT) 部署地址:", paymentTokenAddress);

  // 给测试账户铸造 USDT
  console.log("   铸造 USDT 给测试账户...");
  await paymentToken.mint(deployer.address, ethers.parseUnits("1000000", 6));
  await paymentToken.mint(provider.address, ethers.parseUnits("1000000", 6));
  await paymentToken.mint(user1.address, ethers.parseUnits("600000", 6));
  await paymentToken.mint(user2.address, ethers.parseUnits("600000", 6));
  await paymentToken.mint(user3.address, ethers.parseUnits("600000", 6));
  console.log("   ✓ 铸造完成\n");

  // ============ 2. 部署 CollateralVault ============
  console.log("2. 部署 CollateralVault...");
  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const collateralVault = await CollateralVault.deploy(paymentTokenAddress);
  await collateralVault.waitForDeployment();
  const collateralVaultAddress = await collateralVault.getAddress();
  console.log("   CollateralVault 部署地址:", collateralVaultAddress, "\n");

  // ============ 3. 部署 RevenueManager ============
  console.log("3. 部署 RevenueManager...");
  const RevenueManager = await ethers.getContractFactory("RevenueManager");
  const revenueManager = await RevenueManager.deploy();
  await revenueManager.waitForDeployment();
  const revenueManagerAddress = await revenueManager.getAddress();
  console.log("   RevenueManager 部署地址:", revenueManagerAddress);
  
  // 设置时间单位为 DAY (2)
  await revenueManager.setUnitSeconds(2); // TimeUnit.DAY
  console.log("   ✓ 设置时间单位: DAY\n");

  // ============ 4. 部署 LiquidateManager ============
  console.log("4. 部署 LiquidateManager...");
  const LiquidateManager = await ethers.getContractFactory("LiquidateManager");
  const liquidateManager = await LiquidateManager.deploy();
  await liquidateManager.waitForDeployment();
  const liquidateManagerAddress = await liquidateManager.getAddress();
  console.log("   LiquidateManager 部署地址:", liquidateManagerAddress);

  // 配置 LiquidateManager
  const QUARTERLY_EXPECTED_DIVIDEND = ethers.parseUnits("10000", 6);
  const QUARTER_CYCLE_DAYS = 7;
  await liquidateManager.setQuarterlyExpectedDividend(QUARTERLY_EXPECTED_DIVIDEND);
  await liquidateManager.setQuarterCycleDays(QUARTER_CYCLE_DAYS);
  await liquidateManager.setRevenueManager(revenueManagerAddress);
  await liquidateManager.setCollateralVault(collateralVaultAddress);
  console.log("   ✓ LiquidateManager 配置完成\n");

  // ============ 5. 部署 OrderBook ============
  console.log("5. 部署 OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const feeCollector = deployer.address;
  const feeRate = 50; // 0.5%
  const orderBook = await OrderBook.deploy(feeCollector, feeRate);
  await orderBook.waitForDeployment();
  const orderBookAddress = await orderBook.getAddress();
  console.log("   OrderBook 部署地址:", orderBookAddress);
  console.log("   手续费收集地址:", feeCollector);
  console.log("   手续费率:", feeRate / 10000 * 100, "%\n");

  // ============ 6. 部署 AssetToken ============
  console.log("6. 部署 AssetToken...");
  const AssetToken = await ethers.getContractFactory("AssetToken");
  const assetToken = await AssetToken.deploy();
  await assetToken.waitForDeployment();
  const assetTokenAddress = await assetToken.getAddress();
  console.log("   AssetToken 部署地址:", assetTokenAddress);

  // 初始化 AssetToken
  const metadata = {
    name: "Test Real Estate Token",
    symbol: "TRE",
    totalValue: ethers.parseUnits("1000000", 6),
    fundraiseAmount: ethers.parseUnits("500000", 6),
    maxTotalSupply: ethers.parseUnits("1000000", 18),
    specialPurposeVehicle: deployer.address,
    provider: provider.address,
    createdAt: Math.floor(Date.now() / 1000)
  };

  await assetToken.initialize(
    metadata,
    paymentTokenAddress,
    collateralVaultAddress,
    revenueManagerAddress
  );
  console.log("   ✓ AssetToken 初始化完成");

  // 设置 LiquidateManager
  await assetToken.setLiquidateManager(liquidateManagerAddress);
  console.log("   ✓ 设置 LiquidateManager");

  // 设置 OrderBook
  await assetToken.setOrderBook(orderBookAddress);
  await orderBook.setAssetToken(assetTokenAddress);
  console.log("   ✓ 设置 OrderBook\n");

  // ============ 7. 设置 RevenueManager 的 CollateralVault ============
  console.log("7. 配置 RevenueManager...");
  await revenueManager.setCollateralVault(collateralVaultAddress);
  console.log("   ✓ RevenueManager 设置 CollateralVault\n");

  // ============ 部署总结 ============
  console.log("=" .repeat(60));
  console.log("部署完成! 合约地址汇总:");
  console.log("=" .repeat(60));
  console.log("MockERC20 (USDT):    ", paymentTokenAddress);
  console.log("CollateralVault:     ", collateralVaultAddress);
  console.log("RevenueManager:      ", revenueManagerAddress);
  console.log("LiquidateManager:    ", liquidateManagerAddress);
  console.log("OrderBook:           ", orderBookAddress);
  console.log("AssetToken:          ", assetTokenAddress);
  console.log("=" .repeat(60));

  console.log("\n测试账户余额:");
  console.log("Deployer:    ", deployer.address, "->", ethers.formatUnits(await paymentToken.balanceOf(deployer.address), 6), "USDT");
  console.log("Provider:    ", provider.address, "->", ethers.formatUnits(await paymentToken.balanceOf(provider.address), 6), "USDT");
  console.log("User1:       ", user1.address, "->", ethers.formatUnits(await paymentToken.balanceOf(user1.address), 6), "USDT");
  console.log("User2:       ", user2.address, "->", ethers.formatUnits(await paymentToken.balanceOf(user2.address), 6), "USDT");
  console.log("User3:       ", user3.address, "->", ethers.formatUnits(await paymentToken.balanceOf(user3.address), 6), "USDT");

  // 保存部署信息到文件
  const deploymentInfo = {
    network: "localhost",
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
      provider: provider.address,
      user1: user1.address,
      user2: user2.address,
      user3: user3.address
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
    './deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n✓ 部署信息已保存到 deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

