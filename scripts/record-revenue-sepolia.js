const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("在 Sepolia 上记录收益...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info-sepolia.json', 'utf8'));
  
  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;

  console.log("合约地址:");
  console.log("  RevenueManager:", revenueManagerAddress);
  console.log("  CollateralVault:", collateralVaultAddress);
  console.log("  PaymentToken (USDT):", paymentTokenAddress);
  console.log("");

  // 获取合约实例
  const revenueManager = await ethers.getContractAt("RevenueManager", revenueManagerAddress);
  const collateralVault = await ethers.getContractAt("CollateralVault", collateralVaultAddress);
  const paymentToken = await ethers.getContractAt("MockERC20", paymentTokenAddress);

  const [provider] = await ethers.getSigners();
  console.log("提供方账户:", provider.address);

  // 收益金额：10,000 USDT
  const revenueAmount = ethers.parseUnits("10000", 6);
  
  console.log("\n收益信息:");
  console.log("  收益金额:", ethers.formatUnits(revenueAmount, 6), "USDT");

  // 检查提供方 USDT 余额
  const providerBalance = await paymentToken.balanceOf(provider.address);
  console.log("\n提供方余额:");
  console.log("  USDT:", ethers.formatUnits(providerBalance, 6));

  if (providerBalance < revenueAmount) {
    console.log("\n❌ USDT 余额不足！");
    console.log("   需要先给提供方账户铸造 USDT");
    process.exit(1);
  }

  // 步骤 1: 授权 USDT 给 CollateralVault
  console.log("\n步骤 1: 授权 USDT 给 CollateralVault...");
  const currentAllowance = await paymentToken.allowance(provider.address, collateralVaultAddress);
  console.log("  当前授权额度:", ethers.formatUnits(currentAllowance, 6), "USDT");

  if (currentAllowance < revenueAmount) {
    console.log("  需要授权...");
    const approveTx = await paymentToken.approve(collateralVaultAddress, revenueAmount);
    console.log("  授权交易已发送:", approveTx.hash);
    await approveTx.wait();
    console.log("  ✓ 授权成功");
  } else {
    console.log("  ✓ 授权额度充足");
  }

  // 步骤 2: 存入收益到 CollateralVault
  console.log("\n步骤 2: 存入收益到 CollateralVault...");
  const depositTx = await collateralVault.depositRevenue(revenueAmount);
  console.log("  存入交易已发送:", depositTx.hash);
  await depositTx.wait();
  console.log("  ✓ 收益存入成功");

  // 检查 CollateralVault 状态
  const depositedRevenue = await collateralVault.depositedRevenue();
  console.log("  已存入总收益:", ethers.formatUnits(depositedRevenue, 6), "USDT");

  // 步骤 3: 记录收益到 RevenueManager
  console.log("\n步骤 3: 记录收益到 RevenueManager...");
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  const recordTx = await revenueManager.recordPeriodRevenue(revenueAmount, currentTimestamp);
  console.log("  记录交易已发送:", recordTx.hash);
  await recordTx.wait();
  console.log("  ✓ 收益记录成功");

  // 检查 RevenueManager 状态
  const accumulatedRevenue = await revenueManager.getCurrentAccumulatedRevenue();
  console.log("  累计总收益:", ethers.formatUnits(accumulatedRevenue, 6), "USDT");

  console.log("\n✅ 收益更新成功！");
  console.log("\n在 Sepolia Etherscan 查看:");
  console.log("  存入: https://sepolia.etherscan.io/tx/" + depositTx.hash);
  console.log("  记录: https://sepolia.etherscan.io/tx/" + recordTx.hash);
  console.log("\n现在持有者可以提取分红了（售罄后）");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

