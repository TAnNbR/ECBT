const { ethers } = require("hardhat");

async function main() {
  console.log("给指定地址充值 ETH (本地 Hardhat 节点原生代币)...\n");

  // 目标地址和充值金额
  const targetAddress = "0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7";
  const ethAmount = ethers.parseEther("100"); // 100 ETH

  console.log("配置信息:");
  console.log("  目标地址:", targetAddress);
  console.log("  充值金额:", ethers.formatEther(ethAmount), "ETH\n");

  // 获取 deployer 账户
  const [deployer] = await ethers.getSigners();
  console.log("从账户:", deployer.address);

  // 检查 deployer 余额
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("发送方余额:", ethers.formatEther(deployerBalance), "ETH");

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
    console.error(error);
    process.exit(1);
  });

