const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const userAddress = "0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7";
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  
  console.log("📍 Checking Dividend Withdrawal Conditions");
  console.log("==========================================");
  console.log("User Address:", userAddress);
  console.log("AssetToken Address:", assetTokenAddress);
  console.log("");

  const AssetToken = await hre.ethers.getContractAt("AssetToken", assetTokenAddress);

  // 1. Check if sold out
  const soldOutTimestamp = await AssetToken.soldOutTimestamp();
  const currentTime = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  
  console.log("1️⃣ Sold Out Status:");
  console.log("   soldOutTimestamp:", soldOutTimestamp.toString());
  console.log("   Current time:", currentTime);
  console.log("   Is sold out:", soldOutTimestamp > 0n);
  console.log("   Time since sold out:", soldOutTimestamp > 0n ? currentTime - Number(soldOutTimestamp) : "N/A");
  console.log("   Can withdraw (>1 day):", soldOutTimestamp > 0n && (currentTime - Number(soldOutTimestamp)) > DAY);
  console.log("");

  // 2. Check user balance
  const balance = await AssetToken.balanceOf(userAddress);
  console.log("2️⃣ User Token Balance:");
  console.log("   Balance:", hre.ethers.formatUnits(balance, 18));
  console.log("");

  // 3. Check holder info
  try {
    const holderInfo = await AssetToken.holderInfo(userAddress, 0);
    console.log("3️⃣ Holder Info (index 0):");
    console.log("   shares:", holderInfo.shares.toString());
    console.log("   lastDividendTime:", holderInfo.lastDividendTime.toString());
    console.log("   lastLiquidationClaimTime:", holderInfo.lastLiquidationClaimTime.toString());
    console.log("");
  } catch (error) {
    console.log("3️⃣ Holder Info: Error getting holder info");
    console.log("   ", error.message);
    console.log("");
  }

  // 4. Check RevenueManager
  const revenueManagerAddress = await AssetToken.revenueManager();
  console.log("4️⃣ RevenueManager:");
  console.log("   Address:", revenueManagerAddress);
  
  if (revenueManagerAddress !== hre.ethers.ZeroAddress) {
    const RevenueManager = await hre.ethers.getContractAt("RevenueManager", revenueManagerAddress);
    const currentRevenue = await RevenueManager.lastestAccumulatedRevenue();
    console.log("   Current Revenue:", hre.ethers.formatUnits(currentRevenue, 18));
  }
  console.log("");

  // 5. Try to simulate withdrawal
  console.log("5️⃣ Simulating Withdrawal:");
  try {
    await AssetToken.withdrawDividend.staticCall(userAddress, userAddress);
    console.log("   ✅ Withdrawal would succeed!");
  } catch (error) {
    console.log("   ❌ Withdrawal would fail!");
    console.log("   Error:", error.message);
    
    // Try to extract the revert reason
    if (error.data) {
      console.log("   Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
