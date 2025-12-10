const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;
  
  console.log("📊 Revenue Manager & Vault Status (Sepolia)");
  console.log("============================================");
  console.log("");

  // RevenueManager 数据
  const RevenueManager = await hre.ethers.getContractAt("RevenueManager", revenueManagerAddress);
  
  const lastestAccumulatedRevenue = await RevenueManager.lastestAccumulatedRevenue();
  const unitSeconds = await RevenueManager.getUnitSeconds();
  
  console.log("🔢 RevenueManager:");
  console.log("   Address:", revenueManagerAddress);
  console.log("   lastestAccumulatedRevenue (raw):", lastestAccumulatedRevenue.toString());
  console.log("   lastestAccumulatedRevenue (formatted):", hre.ethers.formatUnits(lastestAccumulatedRevenue, 6), "USDT (6 decimals)");
  console.log("   unitSeconds:", unitSeconds.toString(), "(", unitSeconds.toString() === "86400" ? "DAY" : "OTHER", ")");
  console.log("");

  // CollateralVault 数据
  const CollateralVault = await hre.ethers.getContractAt("CollateralVault", collateralVaultAddress);
  
  const currentRevenue = await CollateralVault.currentRevenue();
  const depositedRevenue = await CollateralVault.depositedRevenue();
  const distributedRevenue = await CollateralVault.distributedRevenue();
  
  console.log("🏦 CollateralVault:");
  console.log("   Address:", collateralVaultAddress);
  console.log("   currentRevenue (raw):", currentRevenue.toString());
  console.log("   currentRevenue (18 decimals):", hre.ethers.formatUnits(currentRevenue, 18));
  console.log("   currentRevenue (6 decimals):", hre.ethers.formatUnits(currentRevenue, 6), "USDT");
  console.log("");
  console.log("   depositedRevenue (raw):", depositedRevenue.toString());
  console.log("   depositedRevenue (6 decimals):", hre.ethers.formatUnits(depositedRevenue, 6), "USDT");
  console.log("");
  console.log("   distributedRevenue (raw):", distributedRevenue.toString());
  console.log("   distributedRevenue (6 decimals):", hre.ethers.formatUnits(distributedRevenue, 6), "USDT");
  console.log("");
  
  const availableRevenue = depositedRevenue - distributedRevenue;
  console.log("   availableRevenue (calculated):", hre.ethers.formatUnits(availableRevenue, 6), "USDT");
  console.log("");
  
  // 精度分析
  console.log("⚠️  PRECISION ANALYSIS:");
  console.log("   RevenueManager uses: 6 decimals (after adapter update)");
  console.log("   CollateralVault.currentRevenue uses: 18 decimals (from old RevenueManager updates)");
  console.log("   CollateralVault.depositedRevenue uses: 6 decimals (manual SPV deposits)");
  console.log("");
  
  // 比较
  console.log("📈 COMPARISON:");
  const revenueManagerValue = Number(hre.ethers.formatUnits(lastestAccumulatedRevenue, 6));
  const vaultCurrentRevenueValue = Number(hre.ethers.formatUnits(currentRevenue, 18));
  const vaultDepositedRevenueValue = Number(hre.ethers.formatUnits(depositedRevenue, 6));
  
  console.log("   RevenueManager accumulated:", revenueManagerValue.toFixed(6), "USDT");
  console.log("   Vault currentRevenue:", vaultCurrentRevenueValue.toFixed(6), "USDT");
  console.log("   Vault depositedRevenue:", vaultDepositedRevenueValue.toFixed(2), "USDT");
  console.log("");
  
  console.log("   ⚠️ Note: currentRevenue and depositedRevenue are DIFFERENT:");
  console.log("      - currentRevenue: Updated by RevenueManager.recordPeriodRevenue()");
  console.log("      - depositedRevenue: Manual deposits by SPV via depositRevenue()");
  console.log("");
  
  // 用户分红预估
  const AssetToken = await hre.ethers.getContractAt("AssetToken", deploymentInfo.contracts.AssetToken);
  const totalSupply = await AssetToken.totalSupply();
  
  console.log("💰 DIVIDEND CALCULATION:");
  console.log("   Total Supply:", hre.ethers.formatUnits(totalSupply, 18));
  console.log("   Revenue for dividends:", hre.ethers.formatUnits(lastestAccumulatedRevenue, 6), "USDT");
  console.log("   Available in vault:", hre.ethers.formatUnits(availableRevenue, 6), "USDT");
  console.log("");
  
  if (availableRevenue < lastestAccumulatedRevenue) {
    console.log("   ❌ PROBLEM: Vault doesn't have enough revenue for dividends!");
    console.log("   Solution: SPV needs to deposit more revenue via depositRevenue()");
  } else {
    console.log("   ✅ Vault has sufficient revenue for dividends");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
