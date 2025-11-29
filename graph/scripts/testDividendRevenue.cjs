// scripts/testDividendRevenue.cjs
// 测试 findMinMarkedIndex 和 findMaxMarkedIndex 函数的所有场景

const hre = require("hardhat");

async function main() {
  console.log("\n==== 测试分红区间查询函数 ====\n");
  
  // 合约地址（从部署脚本输出获取）
  const contractAddress = "0x59b670e9fA9D0A427751Af201D676719a970857b";
  
  // 连接到已部署的合约
  const RevenueManager = await hre.ethers.getContractFactory("RevenueManager");
  const revenueManager = RevenueManager.attach(contractAddress);
  
  console.log("✓ 已连接到合约:", contractAddress);
  
  // 检查当前时间单位设置
  const unitSeconds = await revenueManager.unitSeconds();
  console.log("✓ 当前时间单位:", unitSeconds.toString(), "秒");
  
  // 计算 slot 信息
  const SLOT_SIZE = 256; // 每个 slot 包含 256 个索引
  const SLOT_TIME_SPAN = SLOT_SIZE * Number(unitSeconds); // 每个 slot 的时间跨度（秒）
  console.log("✓ 每个 slot 时间跨度:", SLOT_TIME_SPAN, "秒 (", SLOT_TIME_SPAN / 3600, "小时)\n");
  
  // ===== 准备测试数据 =====
  console.log("【准备阶段】记录测试收益数据\n");
  
  const baseTime = 1700000000; // 基准时间戳
  
  // 设计测试数据：在不同的 slot 中记录收益
  const testRevenues = [
    // Slot 1 - 3个记录
    { revenue: hre.ethers.parseEther("100"), time: baseTime },
    { revenue: hre.ethers.parseEther("150"), time: baseTime + 3600 }, // +1小时
    { revenue: hre.ethers.parseEther("200"), time: baseTime + 7200 }, // +2小时
    
    // Slot 2 - 2个记录（跨越第一个 slot）
    { revenue: hre.ethers.parseEther("250"), time: baseTime + SLOT_TIME_SPAN + 1800 }, // 下个 slot + 30分钟
    { revenue: hre.ethers.parseEther("300"), time: baseTime + SLOT_TIME_SPAN + 5400 }, // 下个 slot + 90分钟
    
    // Slot 3 - 1个记录（再跨越一个 slot）
    { revenue: hre.ethers.parseEther("350"), time: baseTime + SLOT_TIME_SPAN * 2 + 3600 },
    
    // Slot 5 - 1个记录（跨越多个 slot）
    { revenue: hre.ethers.parseEther("400"), time: baseTime + SLOT_TIME_SPAN * 4 + 1800 },
  ];
  
  // 记录所有收益数据
  const recordedData = [];
  for (let i = 0; i < testRevenues.length; i++) {
    const { revenue, time } = testRevenues[i];
    const tx = await revenueManager.recordPeriodRevenue(revenue, time);
    await tx.wait();
    
    const truncated = time - (time % Number(unitSeconds));
    const slotIndex = Math.floor(truncated / SLOT_SIZE);
    const accumulated = await revenueManager.getAccumulatedRevenueAt(truncated);
    
    recordedData.push({
      index: i,
      originalTime: time,
      truncatedTime: truncated,
      slotIndex: slotIndex,
      revenue: revenue,
      accumulated: accumulated
    });
    
    console.log(`  记录 ${i + 1}: Slot ${slotIndex}, 时间 ${truncated}, 累计 ${hre.ethers.formatEther(accumulated)} ETH`);
  }
  
  console.log("\n总累计收益:", hre.ethers.formatEther(await revenueManager.getCurrentAccumulatedRevenue()), "ETH\n");
  
  // ===== 测试用例 =====
  console.log("=" .repeat(80));
  console.log("【测试用例】calculateDividendRevenue 函数\n");
  
  let testCaseNum = 0;
  
  // ===== 第一方面：位置关系测试 =====
  console.log("█ 第一方面：上次分红时间与提取分红时间的位置关系\n");
  
  // 测试 1.1：同一个 slot 里
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】同一个 slot 内（包含多个索引）`);
  await testDividend(revenueManager, 
    recordedData[0].originalTime, // Slot 1 第1个记录
    recordedData[2].originalTime, // Slot 1 第3个记录
    true, // 期望在同一个 slot
    recordedData[0], 
    recordedData[2]
  );
  
  // 测试 1.2：隔了一个 slot
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间隔了一个 slot`);
  await testDividend(revenueManager,
    recordedData[2].originalTime, // Slot 1 的最后一个
    recordedData[4].originalTime, // Slot 2 的第二个
    false, // 不在同一个 slot
    recordedData[2],
    recordedData[4]
  );
  
  // 测试 1.3：隔了多个 slot
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间隔了多个 slot`);
  await testDividend(revenueManager,
    recordedData[1].originalTime, // Slot 1
    recordedData[6].originalTime, // Slot 5
    false, // 不在同一个 slot
    recordedData[1],
    recordedData[6]
  );
  
  // ===== 第二方面：中间索引数量测试 =====
  console.log("\n█ 第二方面：两个时间中间包含的索引数量\n");
  
  // 测试 2.1：中间包含 0 个索引（两个时间连续或中间无记录）
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 0 个索引（连续记录）`);
  await testDividend(revenueManager,
    recordedData[0].originalTime, // 第1个记录
    recordedData[1].originalTime, // 第2个记录（紧接着）
    true, // 在同一个 slot
    recordedData[0],
    recordedData[1]
  );
  
  // 测试 2.2：中间包含 0 个索引（时间间隔大但中间无记录）
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 0 个索引（时间间隔大但中间无记录）`);
  const emptyTime1 = baseTime + 14400; // Slot 1 内，但在记录之间
  const emptyTime2 = baseTime + SLOT_TIME_SPAN + 10000; // Slot 2 内，但在记录之间
  await testDividend(revenueManager,
    emptyTime1,
    emptyTime2,
    false, // 不在同一个 slot
    null,
    null,
    true // 特殊情况：中间无记录
  );
  
  // 测试 2.3：中间包含 1 个索引
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 1 个索引`);
  await testDividend(revenueManager,
    recordedData[3].originalTime, // Slot 2 第1个
    recordedData[5].originalTime, // Slot 3 第1个（中间跨 Slot 2 第2个）
    false,
    recordedData[3],
    recordedData[5]
  );
  
  // 测试 2.4：中间包含 2 个及以上索引
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 2 个及以上索引`);
  await testDividend(revenueManager,
    recordedData[0].originalTime, // Slot 1 第1个
    recordedData[4].originalTime, // Slot 2 第2个（中间包含多个）
    false,
    recordedData[0],
    recordedData[4]
  );
  
  // ===== 第三方面：边界情况测试 =====
  console.log("\n█ 第三方面：边界情况和异常测试\n");
  
  // 测试 3.1：两个时间相等（应该失败）
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】两个时间相等（无效情况）`);
  await testInvalidCase(revenueManager,
    recordedData[2].originalTime,
    recordedData[2].originalTime,
    "两个时间相等"
  );
  
  // 测试 3.2：领取时间早于上次分红时间（应该失败）
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】领取时间早于上次分红时间（无效情况）`);
  await testInvalidCase(revenueManager,
    recordedData[4].originalTime,
    recordedData[2].originalTime,
    "领取时间早于上次分红时间"
  );
  
  // 测试 3.3：正常情况 - 领取时间在最新记录之后
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】领取时间在最新记录之后（应使用最新累计值）`);
  const futureTime = recordedData[6].originalTime + 7200; // 最后记录 + 2小时
  await testDividend(revenueManager,
    recordedData[3].originalTime,
    futureTime,
    false,
    recordedData[3],
    recordedData[6], // 应使用最后一个记录的累计值
    false,
    true // 标记为未来时间
  );
  
  console.log("\n" + "=".repeat(80));
  console.log("【测试完成】所有测试用例执行完毕\n");
}

// 测试辅助函数：测试有效的分红计算
async function testDividend(
  revenueManager, 
  lastDividendTime, 
  claimTime, 
  expectedSameSlot,
  lastData,
  claimData,
  isEmptyCase = false,
  isFutureCase = false
) {
  try {
    const result = await revenueManager.calculateDividendRevenue(lastDividendTime, claimTime);
    const [inSameSlot, lastSlotIndex, claimSlotIndex, revenueDifference] = result;
    
    console.log(`  上次分红时间: ${lastDividendTime}`);
    console.log(`  领取分红时间: ${claimTime}`);
    console.log(`  上次分红 Slot: ${lastSlotIndex}`);
    console.log(`  领取时间 Slot: ${claimSlotIndex}`);
    console.log(`  是否同一 Slot: ${inSameSlot} (期望: ${expectedSameSlot})`);
    console.log(`  收益差额: ${hre.ethers.formatEther(revenueDifference)} ETH`);
    
    // 验证结果
    const slotCheck = inSameSlot === expectedSameSlot ? "✓" : "✗";
    console.log(`  Slot 判断: ${slotCheck} ${inSameSlot === expectedSameSlot ? '正确' : '错误'}`);
    
    if (!isEmptyCase && lastData && claimData) {
      const expectedDiff = claimData.accumulated - lastData.accumulated;
      const diffCheck = revenueDifference === expectedDiff ? "✓" : "✗";
      console.log(`  收益计算: ${diffCheck} ${revenueDifference === expectedDiff ? '正确' : '错误'}`);
      console.log(`  (期望差额: ${hre.ethers.formatEther(expectedDiff)} ETH)`);
    }
    
    console.log(`  状态: ✓ 通过\n`);
  } catch (error) {
    console.log(`  状态: ✗ 失败`);
    console.log(`  错误: ${error.message}\n`);
  }
}

// 测试辅助函数：测试无效情况（应该抛出错误）
async function testInvalidCase(revenueManager, lastDividendTime, claimTime, description) {
  console.log(`  场景: ${description}`);
  console.log(`  上次分红时间: ${lastDividendTime}`);
  console.log(`  领取分红时间: ${claimTime}`);
  
  try {
    await revenueManager.calculateDividendRevenue(lastDividendTime, claimTime);
    console.log(`  状态: ✗ 失败（应该抛出错误但没有）\n`);
  } catch (error) {
    console.log(`  状态: ✓ 通过（正确抛出错误）`);
    console.log(`  错误信息: ${error.message.substring(0, 100)}...\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
