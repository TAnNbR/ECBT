const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("记录新的收益以解决 Invalid range 问题...\n");

  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info-sepolia.json', 'utf8'));
  
  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;

  const revenueManager = await ethers.getContractAt("RevenueManager", revenueManagerAddress);
  const collateralVault = await ethers.getContractAt("CollateralVault", collateralVaultAddress);
  const paymentToken = await ethers.getContractAt("MockERC20", paymentTokenAddress);

  const [provider] = await ethers.getSigners();

  // 小额收益：1 USDT（只是为了创建新的时间点记录）
  const revenueAmount = ethers.parseUnits("1", 6);
  
  console.log("收益信息:");
  console.log("  金额:", ethers.formatUnits(revenueAmount, 6), "USDT");
  console.log("  目的: 在当前时间点创建收益记录\n");

  // 授权和存入
  const currentAllowance = await paymentToken.allowance(provider.address, collateralVaultAddress);
  if (currentAllowance < revenueAmount) {
    console.log("授权 USDT...");
    await (await paymentToken.approve(collateralVaultAddress, revenueAmount)).wait();
    console.log("✓ 授权成功\n");
  }

  console.log("存入收益到 CollateralVault...");
  await (await collateralVault.depositRevenue(revenueAmount)).wait();
  console.log("✓ 存入成功\n");

  // 记录收益（使用当前时间）
  const currentTimestamp = await ethers.provider.getBlock('latest').then(b => b.timestamp);
  console.log("记录收益到 RevenueManager...");
  console.log("  时间戳:", currentTimestamp);
  
  const tx = await revenueManager.recordPeriodRevenue(revenueAmount, currentTimestamp);
  await tx.wait();
  console.log("✓ 记录成功\n");

  const accumulatedRevenue = await revenueManager.getCurrentAccumulatedRevenue();
  console.log("累计总收益:", ethers.formatUnits(accumulatedRevenue, 6), "USDT");

  console.log("\n✅ 完成！现在应该可以提取分红了");
  console.log("   交易: https://sepolia.etherscan.io/tx/" + tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

