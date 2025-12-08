const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("查询账户余额...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
  
  const paymentToken = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.MockERC20);
  const assetToken = await ethers.getContractAt("AssetToken", deploymentInfo.contracts.AssetToken);

  // 要查询的地址
  const address = "0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7";

  console.log("查询地址:", address);
  console.log("=".repeat(60));

  // 查询 ETH 余额
  const ethBalance = await ethers.provider.getBalance(address);
  console.log("\n⚡ ETH 余额:");
  console.log("   ", ethers.formatEther(ethBalance), "ETH");

  // 查询 USDT 余额
  const usdtBalance = await paymentToken.balanceOf(address);
  console.log("\n💵 USDT (Payment Token) 余额:");
  console.log("   ", ethers.formatUnits(usdtBalance, 6), "USDT");

  // 查询资产代币余额
  const assetBalance = await assetToken.balanceOf(address);
  console.log("\n🏠 Asset Token (TRE) 余额:");
  console.log("   ", ethers.formatUnits(assetBalance, 18), "TRE");

  // 查询冻结金额
  const frozenAmount = await assetToken.frozenAmounts(address);
  if (frozenAmount > 0n) {
    console.log("\n❄️  冻结金额:");
    console.log("   ", ethers.formatUnits(frozenAmount, 18), "TRE");
    console.log("   可用余额:", ethers.formatUnits(assetBalance - frozenAmount, 18), "TRE");
  }

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

