const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("检查 Sepolia 上的分红状态...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info-sepolia.json', 'utf8'));
  
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;

  // 获取合约实例
  const assetToken = await ethers.getContractAt("AssetToken", assetTokenAddress);
  const revenueManager = await ethers.getContractAt("RevenueManager", revenueManagerAddress);
  const collateralVault = await ethers.getContractAt("CollateralVault", collateralVaultAddress);

  const [holder] = await ethers.getSigners();
  console.log("持有者地址:", holder.address);
  console.log("=".repeat(60));

  // 1. 检查售罄状态
  console.log("\n1️⃣ 售罄状态:");
  const soldOutTimestamp = await assetToken.soldOutTimestamp();
  const currentTime = Math.floor(Date.now() / 1000);
  const isSoldOut = soldOutTimestamp > 0n;
  const canWithdraw = isSoldOut && currentTime > Number(soldOutTimestamp);

  console.log("   售罄时间戳:", soldOutTimestamp.toString());
  console.log("   当前时间戳:", currentTime);
  console.log("   是否已售罄:", isSoldOut ? "✅ 是" : "❌ 否");
  console.log("   是否可提取:", canWithdraw ? "✅ 是（已过1天）" : "❌ 否（需等待售罄后1天）");

  // 2. 检查持有情况
  console.log("\n2️⃣ 持有情况:");
  const balance = await assetToken.balanceOf(holder.address);
  const frozenAmount = await assetToken.frozenAmounts(holder.address);
  const availableBalance = balance - frozenAmount;

  console.log("   总持有量:", ethers.formatUnits(balance, 18));
  console.log("   冻结数量:", ethers.formatUnits(frozenAmount, 18));
  console.log("   可用余额:", ethers.formatUnits(availableBalance, 18));

  // 3. 检查收益状态
  console.log("\n3️⃣ 收益状态:");
  const accumulatedRevenue = await revenueManager.getCurrentAccumulatedRevenue();
  const depositedRevenue = await collateralVault.depositedRevenue();
  const distributedRevenue = await collateralVault.distributedRevenue();
  const availableRevenue = depositedRevenue - distributedRevenue;

  console.log("   累计记录收益:", ethers.formatUnits(accumulatedRevenue, 6), "USDT");
  console.log("   已存入收益:", ethers.formatUnits(depositedRevenue, 6), "USDT");
  console.log("   已分配收益:", ethers.formatUnits(distributedRevenue, 6), "USDT");
  console.log("   可用收益:", ethers.formatUnits(availableRevenue, 6), "USDT");

  // 4. 检查持有者信息
  console.log("\n4️⃣ 持有者分红信息:");
  try {
    const holderInfoCount = await assetToken.holderInfo(holder.address, 0);
    console.log("   有持有记录");
    
    if (balance > 0n) {
      // 尝试计算可领取分红
      console.log("   正在计算可领取分红...");
      // 注意：实际计算需要调用 withdrawDividend 查看会不会 revert
    }
  } catch (error) {
    console.log("   ❌ 没有持有记录");
  }

  // 5. 判断是否可以提取分红
  console.log("\n" + "=".repeat(60));
  console.log("💡 分红提取检查结果:");
  console.log("=".repeat(60));

  let canClaimDividend = true;
  const issues = [];

  if (!isSoldOut) {
    canClaimDividend = false;
    issues.push("❌ 代币尚未售罄");
    
    const remainingSupply = await assetToken.remainingMintableSupply();
    console.log(`   剩余供应量: ${ethers.formatUnits(remainingSupply, 18)} 代币`);
  } else if (!canWithdraw) {
    canClaimDividend = false;
    const waitTime = Number(soldOutTimestamp) - currentTime;
    issues.push(`❌ 需等待售罄后1天（还需 ${Math.ceil(waitTime / 3600)} 小时）`);
  }

  if (balance === 0n) {
    canClaimDividend = false;
    issues.push("❌ 没有持有代币");
  }

  if (accumulatedRevenue === 0n) {
    canClaimDividend = false;
    issues.push("❌ 没有收益记录");
  }

  if (availableRevenue === 0n) {
    canClaimDividend = false;
    issues.push("❌ CollateralVault 中没有可用收益");
  }

  if (canClaimDividend) {
    console.log("✅ 可以提取分红！");
    console.log("\n执行命令:");
    console.log(`   前端: 访问 Portfolio 页面点击 "Claim All"`);
    console.log(`   或使用脚本测试提取`);
  } else {
    console.log("❌ 暂时无法提取分红\n");
    console.log("问题:");
    issues.forEach(issue => console.log("   " + issue));
    
    console.log("\n解决方法:");
    if (!isSoldOut) {
      console.log("   1. 购买更多代币直到售罄");
      console.log("   2. 或等待其他用户购买");
    }
    if (accumulatedRevenue === 0n) {
      console.log("   1. 运行: npx hardhat run scripts/record-revenue-sepolia.js --network sepolia");
    }
  }

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

