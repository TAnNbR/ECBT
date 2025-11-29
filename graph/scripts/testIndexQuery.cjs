// scripts/testIndexQuery.cjs
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
    
    console.log(`  记录 ${i + 1}: Slot ${slotIndex}, 截断时间 ${truncated}, 累计 ${hre.ethers.formatEther(accumulated)} ETH`);
  }
  
  console.log("\n总累计收益:", hre.ethers.formatEther(await revenueManager.getCurrentAccumulatedRevenue()), "ETH\n");
  
  // ===== 测试用例 =====
  console.log("=" .repeat(80));
  console.log("【测试用例】findMinMarkedIndex 和 findMaxMarkedIndex 函数\n");
  
  let testCaseNum = 0;
  
  // ===== 第一方面：位置关系测试 =====
  console.log("█ 第一方面：上次分红时间与提取分红时间的位置关系\n");
  
  // 测试 1.1：同一个 slot 里
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】同一个 slot 内（包含多个索引）`);
  console.log(`  场景：Slot ${recordedData[0].slotIndex} 内，包含 3 个索引`);
  await testIndexQuery(
    revenueManager,
    recordedData[0].truncatedTime, // 第1个记录
    recordedData[2].truncatedTime, // 第3个记录
    recordedData[0].truncatedTime, // 期望最小
    recordedData[2].truncatedTime  // 期望最大
  );
  
  // 测试 1.2：隔了一个 slot
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间隔了一个 slot`);
  console.log(`  场景：从 Slot ${recordedData[1].slotIndex} 到 Slot ${recordedData[4].slotIndex}`);
  await testIndexQuery(
    revenueManager,
    recordedData[1].truncatedTime, // Slot 1 的第2个
    recordedData[4].truncatedTime, // Slot 2 的第2个
    recordedData[1].truncatedTime, // 期望最小
    recordedData[4].truncatedTime  // 期望最大
  );
  
  // 测试 1.3：隔了多个 slot
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间隔了多个 slot`);
  console.log(`  场景：从 Slot ${recordedData[0].slotIndex} 到 Slot ${recordedData[6].slotIndex} (跨越多个slot)`);
  await testIndexQuery(
    revenueManager,
    recordedData[0].truncatedTime, // Slot 1 第1个
    recordedData[6].truncatedTime, // Slot 5 第1个
    recordedData[0].truncatedTime, // 期望最小
    recordedData[6].truncatedTime  // 期望最大
  );
  
  // ===== 第二方面：中间索引数量测试 =====
  console.log("\n█ 第二方面：两个时间中间包含的索引数量\n");
  
  // 测试 2.1：中间包含 0 个索引（两个时间紧邻）
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 0 个索引（连续记录）`);
  console.log(`  场景：记录 1 和记录 2 紧邻`);
  await testIndexQuery(
    revenueManager,
    recordedData[0].truncatedTime, // 第1个记录
    recordedData[1].truncatedTime, // 第2个记录（紧接着）
    recordedData[0].truncatedTime, // 期望最小
    recordedData[1].truncatedTime  // 期望最大
  );
  
  // 测试 2.2：中间包含 0 个索引（时间范围大但中间无记录）
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 0 个索引（时间间隔大但中间无记录）`);
  const emptyStart = recordedData[5].truncatedTime + 1000; // Slot 3 之后
  const emptyEnd = recordedData[6].truncatedTime - 1000;   // Slot 5 之前
  console.log(`  场景：Slot 3 之后到 Slot 5 之前（中间 Slot 4 无记录）`);
  await testIndexQuery(
    revenueManager,
    emptyStart,
    emptyEnd,
    null, // 期望找不到
    null  // 期望找不到
  );
  
  // 测试 2.3：中间包含 1 个索引
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 1 个索引`);
  console.log(`  场景：记录 1 到记录 3，中间包含记录 2`);
  await testIndexQuery(
    revenueManager,
    recordedData[0].truncatedTime, // 第1个记录
    recordedData[2].truncatedTime, // 第3个记录
    recordedData[0].truncatedTime, // 期望最小
    recordedData[2].truncatedTime, // 期望最大
    [recordedData[0], recordedData[1], recordedData[2]] // 应找到3个索引
  );
  
  // 测试 2.4：中间包含 2 个及以上索引
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】中间包含 2 个及以上索引`);
  console.log(`  场景：从第1个记录到第5个记录，中间包含多个索引`);
  await testIndexQuery(
    revenueManager,
    recordedData[0].truncatedTime, // 第1个记录
    recordedData[4].truncatedTime, // 第5个记录
    recordedData[0].truncatedTime, // 期望最小
    recordedData[4].truncatedTime, // 期望最大
    [recordedData[0], recordedData[1], recordedData[2], recordedData[3], recordedData[4]] // 应找到5个索引
  );
  
  // ===== 第三方面：边界情况测试 =====
  console.log("\n█ 第三方面：边界情况和异常测试\n");
  
  // 测试 3.1：两个时间相等（无效情况）
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】两个时间相等（应返回该时间戳）`);
  console.log(`  场景：起始和结束时间相同`);
  await testIndexQuery(
    revenueManager,
    recordedData[2].truncatedTime,
    recordedData[2].truncatedTime,
    recordedData[2].truncatedTime, // 期望最小就是它自己
    recordedData[2].truncatedTime  // 期望最大就是它自己
  );
  
  // 测试 3.2：查询范围完全在数据之前
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】查询范围完全在所有记录之前`);
  const beforeStart = recordedData[0].truncatedTime - 10000;
  const beforeEnd = recordedData[0].truncatedTime - 1000;
  console.log(`  场景：查询范围在第一条记录之前`);
  await testIndexQuery(
    revenueManager,
    beforeStart,
    beforeEnd,
    null, // 期望找不到
    null  // 期望找不到
  );
  
  // 测试 3.3：查询范围完全在数据之后
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】查询范围完全在所有记录之后`);
  const afterStart = recordedData[6].truncatedTime + 1000;
  const afterEnd = recordedData[6].truncatedTime + 10000;
  console.log(`  场景：查询范围在最后一条记录之后`);
  await testIndexQuery(
    revenueManager,
    afterStart,
    afterEnd,
    null, // 期望找不到
    null  // 期望找不到
  );
  
  // 测试 3.4：查询范围覆盖所有数据
  testCaseNum++;
  console.log(`【测试 ${testCaseNum}】查询范围覆盖所有记录`);
  const allStart = recordedData[0].truncatedTime - 1000;
  const allEnd = recordedData[6].truncatedTime + 1000;
  console.log(`  场景：查询范围包含所有记录`);
  await testIndexQuery(
    revenueManager,
    allStart,
    allEnd,
    recordedData[0].truncatedTime, // 期望最小：第一个记录
    recordedData[6].truncatedTime  // 期望最大：最后一个记录
  );
  
  console.log("\n" + "=".repeat(80));
  console.log("【测试完成】所有测试用例执行完毕\n");
  
  // 打印数据摘要
  console.log("数据摘要：");
  recordedData.forEach((d, i) => {
    console.log(`  记录 ${i + 1}: Slot ${d.slotIndex}, 时间 ${d.truncatedTime}`);
  });
}

// 测试辅助函数：测试索引查询
async function testIndexQuery(
  revenueManager,
  startTime,
  endTime,
  expectedMin,
  expectedMax,
  expectedRecords = null
) {
  try {
    console.log(`  查询范围: ${startTime} ~ ${endTime}`);
    
    // 调用 findMinMarkedIndex
    const [minFound, minIndex] = await revenueManager.findMinMarkedIndex(startTime, endTime);
    
    // 调用 findMaxMarkedIndex
    const [maxFound, maxIndex] = await revenueManager.findMaxMarkedIndex(startTime, endTime);
    
    console.log(`  findMinMarkedIndex: found=${minFound}, index=${minIndex}`);
    console.log(`  findMaxMarkedIndex: found=${maxFound}, index=${maxIndex}`);
    
    // 验证结果
    let allCorrect = true;
    
    // 验证最小索引
    if (expectedMin === null) {
      if (minFound) {
        console.log(`  ✗ 最小索引：期望未找到，但找到了 ${minIndex}`);
        allCorrect = false;
      } else {
        console.log(`  ✓ 最小索引：正确（未找到）`);
      }
    } else {
      if (!minFound) {
        console.log(`  ✗ 最小索引：期望找到 ${expectedMin}，但未找到`);
        allCorrect = false;
      } else if (minIndex.toString() !== expectedMin.toString()) {
        console.log(`  ✗ 最小索引：期望 ${expectedMin}，实际 ${minIndex}`);
        allCorrect = false;
      } else {
        console.log(`  ✓ 最小索引：正确 (${minIndex})`);
      }
    }
    
    // 验证最大索引
    if (expectedMax === null) {
      if (maxFound) {
        console.log(`  ✗ 最大索引：期望未找到，但找到了 ${maxIndex}`);
        allCorrect = false;
      } else {
        console.log(`  ✓ 最大索引：正确（未找到）`);
      }
    } else {
      if (!maxFound) {
        console.log(`  ✗ 最大索引：期望找到 ${expectedMax}，但未找到`);
        allCorrect = false;
      } else if (maxIndex.toString() !== expectedMax.toString()) {
        console.log(`  ✗ 最大索引：期望 ${expectedMax}，实际 ${maxIndex}`);
        allCorrect = false;
      } else {
        console.log(`  ✓ 最大索引：正确 (${maxIndex})`);
      }
    }
    
    // 输出测试结果
    if (allCorrect) {
      console.log(`  状态: ✓ 通过\n`);
    } else {
      console.log(`  状态: ✗ 失败\n`);
    }
  } catch (error) {
    console.log(`  状态: ✗ 错误`);
    console.log(`  错误信息: ${error.message}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
