const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  console.log("📍 AssetToken Address (Sepolia):", assetTokenAddress);
  console.log("");

  const AssetToken = await hre.ethers.getContractAt("AssetToken", assetTokenAddress);
  const metadata = await AssetToken.metadata();
  
  console.log("📊 Asset Metadata:");
  console.log("==================");
  console.log("Name:", metadata.name);
  console.log("Symbol:", metadata.symbol);
  console.log("Provider:", metadata.provider);
  console.log("SPV (Special Purpose Vehicle):", metadata.specialPurposeVehicle);
  console.log("");
  console.log("💡 Only this address can deposit collateral and revenue:");
  console.log("   ", metadata.specialPurposeVehicle);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
