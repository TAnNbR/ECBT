const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("部署账户:", deployer.address);
  console.log("ETH 余额:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.3")) {
    console.log("\n⚠️  警告: 余额不足!");
    console.log("   建议至少: 0.5 ETH");
    console.log("   获取测试 ETH: https://www.alchemy.com/faucets/ethereum-sepolia");
    process.exit(1);
  } else {
    console.log("\n✅ 余额充足，可以开始部署");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

