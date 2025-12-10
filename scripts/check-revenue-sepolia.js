const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  let deploymentInfo;
  
  try {
    const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
    deploymentInfo = JSON.parse(data);
  } catch (error) {
    console.log("❌ Cannot read deployment-info-sepolia.json");
    process.exit(1);
  }

  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;
  console.log("📍 RevenueManager Address (Sepolia):", revenueManagerAddress);
  console.log("");

  const RevenueManager = await hre.ethers.getContractAt(
    "RevenueManager",
    revenueManagerAddress
  );

  const lastestAccumulatedRevenue = await RevenueManager.lastestAccumulatedRevenue();
  const currentAccumulatedRevenue = await RevenueManager.getCurrentAccumulatedRevenue();
  
  console.log("📊 Revenue Manager Data (Sepolia):");
  console.log("====================================");
  console.log("lastestAccumulatedRevenue (raw):", lastestAccumulatedRevenue.toString());
  console.log("");
  
  // 正确方式: 18位精度
  const revenueCorrect = hre.ethers.formatUnits(lastestAccumulatedRevenue, 18);
  console.log("✅ CORRECT (18 decimals):");
  console.log("   ", revenueCorrect);
  console.log("");
  
  // 错误方式: 6位精度 (前端当前用的)
  const revenueWrong = hre.ethers.formatUnits(lastestAccumulatedRevenue, 6);
  console.log("❌ WRONG (6 decimals - frontend bug):");
  console.log("   ", revenueWrong);
  console.log("");
  
  // CollateralVault
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;
  const CollateralVault = await hre.ethers.getContractAt(
    "CollateralVault",
    collateralVaultAddress
  );
  
  const vaultCurrentRevenue = await CollateralVault.currentRevenue();
  const depositedRevenue = await CollateralVault.depositedRevenue();
  console.log("🏦 CollateralVault Data:");
  console.log("   currentRevenue (raw):", vaultCurrentRevenue.toString());
  console.log("   currentRevenue (18 decimals):", hre.ethers.formatUnits(vaultCurrentRevenue, 18));
  console.log("   depositedRevenue (raw):", depositedRevenue.toString());
  console.log("   depositedRevenue (18 decimals):", hre.ethers.formatUnits(depositedRevenue, 18));
  
  console.log("");
  console.log("💡 Summary:");
  console.log("   Raw value in contract:", lastestAccumulatedRevenue.toString());
  console.log("   Should display as:    $", revenueCorrect);
  console.log("   Currently displays as: $", revenueWrong);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
