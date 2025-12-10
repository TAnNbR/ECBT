const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const vaultAddress = deploymentInfo.contracts.CollateralVault;
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  
  console.log("📊 CollateralVault Revenue Status");
  console.log("===================================");
  
  const CollateralVault = await hre.ethers.getContractAt("CollateralVault", vaultAddress);
  
  const depositedRevenue = await CollateralVault.depositedRevenue();
  const distributedRevenue = await CollateralVault.distributedRevenue();
  const availableRevenue = depositedRevenue - distributedRevenue;
  
  console.log("depositedRevenue:", hre.ethers.formatUnits(depositedRevenue, 6), "USDT");
  console.log("distributedRevenue:", hre.ethers.formatUnits(distributedRevenue, 6), "USDT");
  console.log("availableRevenue:", hre.ethers.formatUnits(availableRevenue, 6), "USDT");
  console.log("");
  
  // Calculate required dividend
  const AssetToken = await hre.ethers.getContractAt("AssetToken", assetTokenAddress);
  const userAddress = "0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7";
  
  const balance = await AssetToken.balanceOf(userAddress);
  const totalSupply = await AssetToken.totalSupply();
  const holderInfo = await AssetToken.holderInfo(userAddress, 0);
  
  console.log("User Balance:", hre.ethers.formatUnits(balance, 18));
  console.log("Total Supply:", hre.ethers.formatUnits(totalSupply, 18));
  console.log("User Share:", (Number(balance) / Number(totalSupply) * 100).toFixed(2) + "%");
  console.log("");
  
  // Get revenue manager info
  const revenueManagerAddress = await AssetToken.revenueManager();
  const RevenueManager = await hre.ethers.getContractAt("RevenueManager", revenueManagerAddress);
  
  const lastestRevenue = await RevenueManager.lastestAccumulatedRevenue();
  const soldOutTimestamp = await AssetToken.soldOutTimestamp();
  
  console.log("RevenueManager lastestAccumulatedRevenue:", hre.ethers.formatUnits(lastestRevenue, 18));
  console.log("SoldOut Timestamp:", soldOutTimestamp.toString());
  console.log("Last Dividend Time:", holderInfo.lastDividendTime.toString());
  console.log("");
  
  // 问题：depositedRevenue 是 6 位精度，但分红计算可能基于 18 位精度的收益
  console.log("⚠️  ISSUE DETECTED:");
  console.log("   depositedRevenue uses 6 decimals (USDT)");
  console.log("   RevenueManager uses 18 decimals");
  console.log("   Dividend calculation might expect 18 decimal revenue in vault!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
