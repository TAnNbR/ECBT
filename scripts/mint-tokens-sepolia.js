const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("在 Sepolia 上给指定地址铸造 USDT...\n");

  // 读取 Sepolia 部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info-sepolia.json', 'utf8'));
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;

  // 目标地址和铸造金额
  const targetAddress = "0x58ac06617d42bca05d958d7ee314f621fd8c16b7";
  const mintAmount = ethers.parseUnits("5000000000000000000000000000", 6); // 50,000,000 USDT

  console.log("配置信息:");
  console.log("  网络: Sepolia");
  console.log("  PaymentToken (USDT) 地址:", paymentTokenAddress);
  console.log("  目标地址:", targetAddress);
  console.log("  铸造金额:", ethers.formatUnits(mintAmount, 6), "USDT\n");

  // 获取合约实例
  const paymentToken = await ethers.getContractAt("MockERC20", paymentTokenAddress);

  // 检查铸造前余额
  const balanceBefore = await paymentToken.balanceOf(targetAddress);
  console.log("铸造前余额:", ethers.formatUnits(balanceBefore, 6), "USDT");

  // 铸造代币
  console.log("\n正在铸造代币...");
  const tx = await paymentToken.mint(targetAddress, mintAmount);
  console.log("交易已发送:", tx.hash);
  console.log("等待确认...");
  
  await tx.wait();
  console.log("✓ 交易已确认");

  // 检查铸造后余额
  const balanceAfter = await paymentToken.balanceOf(targetAddress);
  console.log("\n铸造后余额:", ethers.formatUnits(balanceAfter, 6), "USDT");
  console.log("增加金额:", ethers.formatUnits(balanceAfter - balanceBefore, 6), "USDT");

  console.log("\n✓ 铸造成功！");
  console.log("\n在 Sepolia Etherscan 查看:");
  console.log("  交易: https://sepolia.etherscan.io/tx/" + tx.hash);
  console.log("  代币: https://sepolia.etherscan.io/token/" + paymentTokenAddress);
  console.log("  账户: https://sepolia.etherscan.io/address/" + targetAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

