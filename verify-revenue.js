const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const RevenueManager = await hre.ethers.getContractAt(
    "RevenueManager",
    deploymentInfo.contracts.RevenueManager
  );

  const revenue = await RevenueManager.lastestAccumulatedRevenue();
  
  console.log("📊 RevenueManager 链上数据:");
  console.log("   Raw value:", revenue.toString());
  console.log("   Formatted (6 decimals):", hre.ethers.formatUnits(revenue, 6), "USDT");
  console.log("");
  console.log("✅ 前端应该显示:", hre.ethers.formatUnits(revenue, 6), "USDT");
}

main().catch(console.error);
