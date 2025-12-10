const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const vaultAddress = deploymentInfo.contracts.CollateralVault;
  console.log("📍 CollateralVault Address (Sepolia):", vaultAddress);
  console.log("");

  const CollateralVault = await hre.ethers.getContractAt("CollateralVault", vaultAddress);

  // 查询所有相关收益数据
  const currentRevenue = await CollateralVault.currentRevenue();
  const depositedRevenue = await CollateralVault.depositedRevenue();
  const distributedRevenue = await CollateralVault.distributedRevenue();

  console.log("📊 CollateralVault Revenue Data:");
  console.log("===================================");
  console.log("");
  
  console.log("currentRevenue (raw):", currentRevenue.toString());
  console.log("currentRevenue (18 decimals):", hre.ethers.formatUnits(currentRevenue, 18));
  console.log("");
  
  console.log("depositedRevenue (raw):", depositedRevenue.toString());
  console.log("depositedRevenue (6 decimals - USDT):", hre.ethers.formatUnits(depositedRevenue, 6));
  console.log("");
  
  console.log("distributedRevenue (raw):", distributedRevenue.toString());
  console.log("distributedRevenue (18 decimals):", hre.ethers.formatUnits(distributedRevenue, 18));
  console.log("");
  
  console.log("💡 Note:");
  console.log("   - currentRevenue uses 18 decimals (from RevenueManager)");
  console.log("   - depositedRevenue uses 6 decimals (USDT precision)");
  console.log("   - These are DIFFERENT values!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
