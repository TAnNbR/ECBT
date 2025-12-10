const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  // 从命令行参数获取地址和金额
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log("用法: npx hardhat run scripts/mint-tokens-flexible.js --network localhost -- <地址> [金额]");
    console.log("\n示例:");
    console.log("  npx hardhat run scripts/mint-tokens-flexible.js --network localhost -- 0x123... 500000");
    console.log("\n参数:");
    console.log("  <地址>    必需 - 接收代币的钱包地址");
    console.log("  [金额]    可选 - 充值金额 (USDT)，默认 1,000,000");
    process.exit(1);
  }

  const targetAddress = args[0];
  const amountInUsdt = args[1] ? parseFloat(args[1]) : 500000000;
  const mintAmount = ethers.parseUnits(amountInUsdt.toString(), 6);

  console.log("给指定地址充值测试代币 (USDT)...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;

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
    console.error("错误:", error.message);
    process.exit(1);
  });

