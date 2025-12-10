const hre = require("hardhat");

async function main() {
  // 读取部署信息
  const fs = require('fs');
  let deploymentInfo;
  
  try {
    const data = fs.readFileSync('./deployment-info.json', 'utf8');
    deploymentInfo = JSON.parse(data);
  } catch (error) {
    console.log("❌ Cannot read deployment-info.json");
    process.exit(1);
  }

  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;
  console.log("📍 RevenueManager Address:", revenueManagerAddress);
  console.log("");

  // 获取合约实例
  const RevenueManager = await hre.ethers.getContractAt(
    "RevenueManager",
    revenueManagerAddress
  );

  // 查询 lastestAccumulatedRevenue
  const lastestAccumulatedRevenue = await RevenueManager.lastestAccumulatedRevenue();
  const currentAccumulatedRevenue = await RevenueManager.getCurrentAccumulatedRevenue();
  
  console.log("📊 Revenue Manager Data:");
  console.log("========================");
  console.log("lastestAccumulatedRevenue (raw):", lastestAccumulatedRevenue.toString());
  console.log("getCurrentAccumulatedRevenue (raw):", currentAccumulatedRevenue.toString());
  console.log("");
  
  // 转换为可读格式 (18位精度)
  const revenueInEther = hre.ethers.formatUnits(lastestAccumulatedRevenue, 18);
  console.log("💰 Actual Revenue Amount (18 decimals):");
  console.log("   ", revenueInEther, "tokens");
  console.log("");
  
  // 如果错误地用6位精度解析
  const wrongFormat = hre.ethers.formatUnits(lastestAccumulatedRevenue, 6);
  console.log("❌ Wrong Format (6 decimals - what frontend shows):");
  console.log("   ", wrongFormat);
  console.log("");
  
  // CollateralVault 的 currentRevenue
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;
  const CollateralVault = await hre.ethers.getContractAt(
    "CollateralVault",
    collateralVaultAddress
  );
  
  const vaultCurrentRevenue = await CollateralVault.currentRevenue();
  console.log("🏦 CollateralVault.currentRevenue (raw):", vaultCurrentRevenue.toString());
  console.log("   Amount (18 decimals):", hre.ethers.formatUnits(vaultCurrentRevenue, 18));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
