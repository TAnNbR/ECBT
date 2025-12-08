const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("========================================");
  console.log("与已部署的合约交互");
  console.log("========================================\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
  
  const [deployer, provider, user1, user2, user3] = await ethers.getSigners();

  // 获取合约实例
  const paymentToken = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.MockERC20);
  const assetToken = await ethers.getContractAt("AssetToken", deploymentInfo.contracts.AssetToken);
  const collateralVault = await ethers.getContractAt("CollateralVault", deploymentInfo.contracts.CollateralVault);
  const revenueManager = await ethers.getContractAt("RevenueManager", deploymentInfo.contracts.RevenueManager);
  const liquidateManager = await ethers.getContractAt("LiquidateManager", deploymentInfo.contracts.LiquidateManager);
  const orderBook = await ethers.getContractAt("OrderBook", deploymentInfo.contracts.OrderBook);

  // ============ 1. 检查合约状态 ============
  console.log("1. 合约基本信息:");
  const metadata = await assetToken.metadata();
  console.log("   AssetToken 名称:", metadata.name);
  console.log("   AssetToken 符号:", metadata.symbol);
  console.log("   总发行量上限:", ethers.formatUnits(metadata.maxTotalSupply, 18), "TRE");
  console.log("   募资目标:", ethers.formatUnits(metadata.fundraiseAmount, 6), "USDT");
  console.log("   当前总供应量:", ethers.formatUnits(await assetToken.totalSupply(), 18), "TRE");
  console.log("   剩余可铸造供应量:", ethers.formatUnits(await assetToken.remainingMintableSupply(), 18), "TRE");
  console.log("   是否售罄:", await assetToken.isSoldOut());
  console.log();

  // ============ 2. 检查账户余额 ============
  console.log("2. 账户 USDT 余额:");
  console.log("   Deployer:", ethers.formatUnits(await paymentToken.balanceOf(deployer.address), 6), "USDT");
  console.log("   Provider:", ethers.formatUnits(await paymentToken.balanceOf(provider.address), 6), "USDT");
  console.log("   User1:   ", ethers.formatUnits(await paymentToken.balanceOf(user1.address), 6), "USDT");
  console.log("   User2:   ", ethers.formatUnits(await paymentToken.balanceOf(user2.address), 6), "USDT");
  console.log("   User3:   ", ethers.formatUnits(await paymentToken.balanceOf(user3.address), 6), "USDT");
  console.log();

  // ============ 3. CollateralVault 状态 ============
  console.log("3. CollateralVault 状态:");
  console.log("   总募集金额:", ethers.formatUnits(await collateralVault.totalFundraisedAmount(), 6), "USDT");
  console.log("   已提取募集金额:", ethers.formatUnits(await collateralVault.totalWithdrawnFundraise(), 6), "USDT");
  console.log("   总押金金额:", ethers.formatUnits(await collateralVault.totalCollateralAmount(), 6), "USDT");
  console.log("   当前收益额:", ethers.formatUnits(await collateralVault.currentRevenue(), 6), "USDT");
  console.log("   已存入收益额:", ethers.formatUnits(await collateralVault.depositedRevenue(), 6), "USDT");
  console.log("   已分配收益额:", ethers.formatUnits(await collateralVault.distributedRevenue(), 6), "USDT");
  console.log();

  // ============ 4. RevenueManager 状态 ============
  console.log("4. RevenueManager 状态:");
  console.log("   时间单位(秒):", await revenueManager.getUnitSeconds());
  console.log("   当前累计收益:", ethers.formatUnits(await revenueManager.getCurrentAccumulatedRevenue(), 6), "USDT");
  console.log("   CollateralVault 地址:", await revenueManager.collateralVault());
  console.log();

  // ============ 5. LiquidateManager 状态 ============
  console.log("5. LiquidateManager 状态:");
  console.log("   季度预期分红:", ethers.formatUnits(await liquidateManager.quarterlyExpectedDividend(), 6), "USDT");
  console.log("   季度周期天数:", await liquidateManager.quarterCycleDays());
  console.log();

  // ============ 6. OrderBook 状态 ============
  console.log("6. OrderBook 状态:");
  console.log("   手续费率:", await orderBook.feeRate(), "/ 10000");
  console.log("   手续费收集地址:", await orderBook.feeCollector());
  console.log("   关联的 AssetToken:", await orderBook.assetToken());
  console.log("   下一个订单 ID:", await orderBook.nextOrderId());
  console.log();

  console.log("========================================");
  console.log("✓ 所有合约部署成功并正常运行");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

