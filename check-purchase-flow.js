const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  console.log("🔍 Purchase Flow Analysis (Sepolia)");
  console.log("====================================");
  console.log("");

  // 合约地址
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;

  console.log("📍 Contract Addresses:");
  console.log("   AssetToken:", assetTokenAddress);
  console.log("   PaymentToken (USDT):", paymentTokenAddress);
  console.log("   CollateralVault:", collateralVaultAddress);
  console.log("");

  // 获取合约
  const AssetToken = await hre.ethers.getContractAt("AssetToken", assetTokenAddress);

  // 检查 AssetToken.purchase 函数的逻辑
  const paymentToken = await AssetToken.paymentToken();
  const collateralVault = await AssetToken.collateralVault();

  console.log("📋 AssetToken Configuration:");
  console.log("   paymentToken:", paymentToken);
  console.log("   collateralVault:", collateralVault);
  console.log("");

  console.log("💡 Purchase Flow:");
  console.log("   1. User calls: AssetToken.purchase(amount)");
  console.log("   2. AssetToken calls: paymentToken.transferFrom(user, collateralVault, payment)");
  console.log("   3. This means: AssetToken needs approval to spend user's paymentToken");
  console.log("");

  console.log("✅ CORRECT Approval:");
  console.log("   approve(paymentToken, AssetToken, amount)");
  console.log("   即: paymentToken.approve(AssetToken, amount)");
  console.log("");

  console.log("❌ WRONG Approval:");
  console.log("   approve(paymentToken, CollateralVault, amount) ← WRONG!");
  console.log("");

  console.log("📝 Frontend should do:");
  console.log("   CONTRACTS.PaymentToken.approve(CONTRACTS.AssetToken, paymentAmount)");
  console.log("");

  // 验证合约地址匹配
  if (paymentToken.toLowerCase() !== paymentTokenAddress.toLowerCase()) {
    console.log("⚠️  WARNING: paymentToken mismatch!");
  }
  if (collateralVault.toLowerCase() !== collateralVaultAddress.toLowerCase()) {
    console.log("⚠️  WARNING: collateralVault mismatch!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
