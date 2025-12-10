const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  console.log("🔍 Precision Analysis");
  console.log("=====================");
  console.log("");

  // RevenueManager
  const RevenueManager = await hre.ethers.getContractAt(
    "RevenueManager", 
    deploymentInfo.contracts.RevenueManager
  );
  
  const lastestAccumulatedRevenue = await RevenueManager.lastestAccumulatedRevenue();
  
  console.log("📊 RevenueManager:");
  console.log("   Raw value:", lastestAccumulatedRevenue.toString());
  console.log("");
  
  console.log("   If 6 decimals (USDT):");
  console.log("     →", hre.ethers.formatUnits(lastestAccumulatedRevenue, 6), "USDT");
  console.log("");
  
  console.log("   If 18 decimals:");
  console.log("     →", hre.ethers.formatUnits(lastestAccumulatedRevenue, 18), "tokens");
  console.log("");
  
  // CollateralVault
  const CollateralVault = await hre.ethers.getContractAt(
    "CollateralVault",
    deploymentInfo.contracts.CollateralVault
  );
  
  const currentRevenue = await CollateralVault.currentRevenue();
  const depositedRevenue = await CollateralVault.depositedRevenue();
  
  console.log("🏦 CollateralVault:");
  console.log("   currentRevenue (raw):", currentRevenue.toString());
  console.log("   depositedRevenue (raw):", depositedRevenue.toString());
  console.log("");
  
  console.log("💡 Conclusion:");
  console.log("   Raw value 39026507000000000000:");
  console.log("   - Has 18 digits after the first digit");
  console.log("   - This is typical of 18 decimal precision");
  console.log("   - Value = 39.026507 (with 18 decimals)");
  console.log("");
  
  console.log("⚠️  Current Status:");
  console.log("   ❌ RevenueManager 已记录的数据是 18 位精度");
  console.log("   ✅ Adapter 现在配置为输出 6 位精度");
  console.log("   ❌ 但旧数据仍然是 18 位");
  console.log("");
  
  console.log("🔧 Solution:");
  console.log("   选项 A: 保持 18 位精度 (推荐)");
  console.log("     - Adapter 改回 18 位");
  console.log("     - 前端显示用 18 位");
  console.log("     - 分红计算用 18 位");
  console.log("");
  console.log("   选项 B: 改为 6 位精度");
  console.log("     - 重新部署 RevenueManager");
  console.log("     - 清除历史数据");
  console.log("     - 从头开始记录");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
