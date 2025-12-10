const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("诊断 Invalid range 错误...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info-sepolia.json', 'utf8'));
  
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;

  const assetToken = await ethers.getContractAt("AssetToken", assetTokenAddress);
  const revenueManager = await ethers.getContractAt("RevenueManager", revenueManagerAddress);

  const [holder] = await ethers.getSigners();
  console.log("持有者地址:", holder.address);
  console.log("=".repeat(60));

  // 1. 获取售罄时间
  const soldOutTimestamp = await assetToken.soldOutTimestamp();
  const currentTime = Math.floor(Date.now() / 1000);
  
  console.log("\n时间信息:");
  console.log("  售罄时间戳:", soldOutTimestamp.toString());
  console.log("  当前时间:", currentTime);
  console.log("  时间差:", currentTime - Number(soldOutTimestamp), "秒");

  // 2. 获取持有者信息
  console.log("\n持有者信息:");
  try {
    const holderInfo = await assetToken.holderInfo(holder.address, 0);
    console.log("  持有份额:", ethers.formatUnits(holderInfo.shares, 18));
    console.log("  持有开始时间:", holderInfo.holdingStartTime.toString());
    console.log("  上次分红时间:", holderInfo.lastDividendTime.toString());
    console.log("  上次清算时间:", holderInfo.lastLiquidationClaimTime.toString());
    
    const INVALID_TIMESTAMP = 2n ** 256n - 1n;
    
    // 3. 分析问题
    console.log("\n分析:");
    if (holderInfo.lastDividendTime === INVALID_TIMESTAMP) {
      console.log("  ✅ lastDividendTime 是 INVALID_TIMESTAMP（从未领取）");
    } else {
      console.log("  ⚠️  lastDividendTime 已设置:", holderInfo.lastDividendTime.toString());
      
      // 检查时间范围
      if (holderInfo.lastDividendTime >= BigInt(currentTime)) {
        console.log("  ❌ 问题: lastDividendTime >= currentTime");
        console.log("     这会导致 findMaxMarkedIndex 的 startIndex >= endIndex");
      }
    }

    // 4. 检查收益记录
    console.log("\n收益记录检查:");
    const unitSeconds = await revenueManager.getUnitSeconds();
    console.log("  时间单位:", unitSeconds.toString(), "秒 (DAY)");
    
    const truncatedSoldOut = await revenueManager.truncateTimestampBySeconds(soldOutTimestamp);
    const truncatedCurrent = await revenueManager.truncateTimestampBySeconds(currentTime);
    
    console.log("  截断后的售罄时间:", truncatedSoldOut.toString());
    console.log("  截断后的当前时间:", truncatedCurrent.toString());
    
    if (truncatedSoldOut >= truncatedCurrent) {
      console.log("  ❌ 问题: 截断后 soldOutTimestamp >= currentTimestamp");
      console.log("     这会导致 findMaxMarkedIndex 调用失败");
    }

    // 5. 尝试查找收益记录
    console.log("\n查找收益记录:");
    try {
      const [foundEnd, endIndex] = await revenueManager.findMaxMarkedIndex(
        truncatedSoldOut,
        truncatedCurrent
      );
      console.log("  ✅ 找到收益记录:", foundEnd);
      console.log("  最大索引:", endIndex.toString());
    } catch (error) {
      console.log("  ❌ findMaxMarkedIndex 调用失败:", error.message);
      console.log("\n这就是 'Invalid range' 错误的原因！");
      
      console.log("\n解决方法:");
      console.log("  问题: 当前时间和售罄时间截断后在同一天");
      console.log("  解决: 等待到第二天（UTC 时间）或记录新的收益");
    }

    // 6. 检查已记录的收益时间点
    console.log("\n已记录的收益信息:");
    const accumulatedRevenue = await revenueManager.getCurrentAccumulatedRevenue();
    console.log("  累计收益:", ethers.formatUnits(accumulatedRevenue, 6), "USDT");
    
  } catch (error) {
    console.error("错误:", error);
  }

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

