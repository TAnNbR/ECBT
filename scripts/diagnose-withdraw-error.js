const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("检查能否提取分红的详细诊断...\n");

  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info-sepolia.json', 'utf8'));
  const assetToken = await ethers.getContractAt("AssetToken", deploymentInfo.contracts.AssetToken);
  const revenueManager = await ethers.getContractAt("RevenueManager", deploymentInfo.contracts.RevenueManager);

  const [holder] = await ethers.getSigners();

  // 获取关键时间
  const soldOutTimestamp = await assetToken.soldOutTimestamp();
  const currentTime = await ethers.provider.getBlock('latest').then(b => b.timestamp);
  
  console.log("⏰ 时间检查:");
  console.log("  售罄时间戳:", soldOutTimestamp.toString());
  console.log("  当前区块时间:", currentTime);
  console.log("  差值:", currentTime - Number(soldOutTimestamp), "秒");
  
  const canWithdraw = currentTime > Number(soldOutTimestamp);
  console.log("  可以提取分红?", canWithdraw ? "✅ 是" : "❌ 否");
  
  if (!canWithdraw) {
    const waitSeconds = Number(soldOutTimestamp) - currentTime;
    const waitHours = Math.ceil(waitSeconds / 3600);
    console.log(`  ⏳ 需要等待: ${waitHours} 小时`);
    console.log(`  ⏳ 需要等待: ${Math.ceil(waitSeconds / 60)} 分钟`);
    console.log(`  ⏳ 需要等待: ${waitSeconds} 秒`);
  }

  // 获取持有者信息
  console.log("\n📊 持有者信息:");
  const holderInfoCount = await assetToken.holderInfo(holder.address, 0);
  console.log("  份额:", ethers.formatUnits(holderInfoCount.shares, 18));
  console.log("  lastDividendTime:", holderInfoCount.lastDividendTime.toString());
  
  const INVALID_TIMESTAMP = 2n ** 256n - 1n;
  const isFirstTime = holderInfoCount.lastDividendTime === INVALID_TIMESTAMP;
  console.log("  是否首次提取?", isFirstTime ? "是" : "否");

  // 查找收益记录
  console.log("\n💰 收益记录检查:");
  const accumulatedRevenue = await revenueManager.getCurrentAccumulatedRevenue();
  console.log("  累计总收益:", ethers.formatUnits(accumulatedRevenue, 6), "USDT");
  
  if (accumulatedRevenue > 0n) {
    console.log("  ✅ 有收益记录");
    
    // 尝试查找收益索引
    try {
      if (isFirstTime) {
        // 首次提取：从售罄时间到当前时间
        console.log("\n  查询范围（首次提取）:");
        console.log("    从: soldOutTimestamp =", soldOutTimestamp.toString());
        console.log("    到: currentTime =", currentTime);
        
        const [found, index] = await revenueManager.findMaxMarkedIndex(
          soldOutTimestamp,
          BigInt(currentTime)
        );
        console.log("    ✅ 查找成功，找到索引:", index.toString());
      } else {
        // 非首次：从上次领取时间到当前时间
        console.log("\n  查询范围（非首次提取）:");
        console.log("    从: lastDividendTime =", holderInfoCount.lastDividendTime.toString());
        console.log("    到: currentTime =", currentTime);
        
        if (holderInfoCount.lastDividendTime >= BigInt(currentTime)) {
          console.log("    ❌ Invalid range: lastDividendTime >= currentTime");
          console.log("    这就是错误原因！");
        } else {
          const [found, index] = await revenueManager.findMaxMarkedIndex(
            holderInfoCount.lastDividendTime,
            BigInt(currentTime)
          );
          console.log("    ✅ 查找成功，找到索引:", index.toString());
        }
      }
    } catch (error) {
      console.log("    ❌ 查找失败:", error.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("💡 结论:");
  console.log("=".repeat(60));
  
  if (!canWithdraw) {
    console.log("❌ 主要问题: 还没到可以提取分红的时间");
    const waitSeconds = Number(soldOutTimestamp) - currentTime;
    console.log(`   需要等待约 ${Math.ceil(waitSeconds / 3600)} 小时`);
  } else if (accumulatedRevenue === 0n) {
    console.log("❌ 主要问题: 没有收益记录");
    console.log("   解决: 运行 record-revenue-sepolia.js 记录收益");
  } else {
    console.log("✅ 应该可以提取分红");
    console.log("   如果还是报错，请检查上面的详细信息");
  }
}

main().catch(console.error);

