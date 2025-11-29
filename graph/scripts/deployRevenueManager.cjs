// scripts/deployRevenueManager.cjs
// 部署 RevenueManager 合约到本地网络

const hre = require("hardhat");

async function main() {
  console.log("\n==== 部署 RevenueManager 合约 ====\n");
  
  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "ETH");
  
  // 部署合约
  console.log("\n正在部署 RevenueManager...");
  const RevenueManagerFactory = await hre.ethers.getContractFactory("RevenueManager");
  const revenueManager = await RevenueManagerFactory.deploy();
  await revenueManager.waitForDeployment();
  
  const contractAddress = await revenueManager.getAddress();
  console.log("✓ RevenueManager 已部署到:", contractAddress);
  
  // 设置时间单位为 HOUR (枚举值 0)
  const tx = await revenueManager.setUnitSeconds(0); // TimeUnit.HOUR = 1
  await tx.wait();
  console.log("✓ 时间单位已设置为 HOUR (3600秒)");
  
  // 验证设置
  const unitSeconds = await revenueManager.unitSeconds();
  console.log("✓ 当前时间单位:", unitSeconds.toString(), "秒");
  
  console.log("\n==== 部署完成 ====");
  console.log("\n请设置环境变量:");
  console.log(`export ADAPTER_CONTRACT=${contractAddress}`);
  console.log(`export ENABLE_ONCHAIN=true`);
  console.log("\n然后重启 updater 服务开始链上更新");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
