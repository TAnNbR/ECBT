const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("给指定地址充值测试代币 (USDT)...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;

  // 目标地址和充值金额
  const targetAddress = "0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7";
  const mintAmount = ethers.parseUnits("500000000", 6); // 1,000,000 USDT

  console.log("配置信息:");
  console.log("  PaymentToken (USDT) 地址:", paymentTokenAddress);
  console.log("  目标地址:", targetAddress);
  console.log("  充值金额:", ethers.formatUnits(mintAmount, 6), "USDT\n");

  // 获取合约实例
  const paymentToken = await ethers.getContractAt("MockERC20", paymentTokenAddress);

  // 检查充值前余额
  const balanceBefore = await paymentToken.balanceOf(targetAddress);
  console.log("充值前余额:", ethers.formatUnits(balanceBefore, 6), "USDT");

  // 铸造代币
  console.log("\n正在铸造代币...");
  const tx = await paymentToken.mint(targetAddress, mintAmount);
  await tx.wait();
  console.log("✓ 交易已确认:", tx.hash);

  // 检查充值后余额
  const balanceAfter = await paymentToken.balanceOf(targetAddress);
  console.log("\n充值后余额:", ethers.formatUnits(balanceAfter, 6), "USDT");
  console.log("增加金额:", ethers.formatUnits(balanceAfter - balanceBefore, 6), "USDT");

  console.log("\n✓ 充值成功！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

