const { ethers } = require("hardhat");

async function main() {
  // 从命令行参数获取地址和金额
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log("用法: npx hardhat run scripts/send-eth-flexible.js --network localhost -- <地址> [金额]");
    console.log("\n示例:");
    console.log("  npx hardhat run scripts/send-eth-flexible.js --network localhost -- 0x123... 50");
    console.log("\n参数:");
    console.log("  <地址>    必需 - 接收 ETH 的钱包地址");
    console.log("  [金额]    可选 - 充值金额 (ETH)，默认 100");
    process.exit(1);
  }

  const targetAddress = args[0];
  const ethAmountNum = args[1] ? parseFloat(args[1]) : 100;
  const ethAmount = ethers.parseEther(ethAmountNum.toString());

  console.log("给指定地址充值 ETH (本地 Hardhat 节点原生代币)...\n");

  console.log("配置信息:");
  console.log("  目标地址:", targetAddress);
  console.log("  充值金额:", ethers.formatEther(ethAmount), "ETH\n");

  // 获取 deployer 账户
  const [deployer] = await ethers.getSigners();
  console.log("从账户:", deployer.address);

  // 检查 deployer 余额
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("发送方余额:", ethers.formatEther(deployerBalance), "ETH");

  if (deployerBalance < ethAmount) {
    console.error("\n❌ 错误: 发送方 ETH 余额不足！");
    process.exit(1);
  }

  // 检查目标地址充值前余额
  const balanceBefore = await ethers.provider.getBalance(targetAddress);
  console.log("目标地址充值前余额:", ethers.formatEther(balanceBefore), "ETH");

  // 发送 ETH
  console.log("\n正在发送 ETH...");
  const tx = await deployer.sendTransaction({
    to: targetAddress,
    value: ethAmount
  });
  await tx.wait();
  console.log("✓ 交易已确认:", tx.hash);

  // 检查充值后余额
  const balanceAfter = await ethers.provider.getBalance(targetAddress);
  console.log("\n充值后余额:", ethers.formatEther(balanceAfter), "ETH");
  console.log("增加金额:", ethers.formatEther(balanceAfter - balanceBefore), "ETH");

  // 检查发送方剩余余额
  const deployerBalanceAfter = await ethers.provider.getBalance(deployer.address);
  console.log("\n发送方剩余余额:", ethers.formatEther(deployerBalanceAfter), "ETH");

  console.log("\n✓ ETH 充值成功！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });

