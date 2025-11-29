// scripts/testRevenueManager.cjs
// 测试 RevenueManager 合约的记录和查询功能

const hre = require("hardhat");

async function main() {
  console.log("\n==== 测试 RevenueManager 合约 ====\n");
  
  // 合约地址（从部署脚本输出获取）
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  // 连接到已部署的合约
  const RevenueManager = await hre.ethers.getContractFactory("RevenueManager");
  const revenueManager = RevenueManager.attach(contractAddress);
  
  console.log("✓ 已连接到合约:", contractAddress);
  
  // 检查当前时间单位设置
  const unitSeconds = await revenueManager.unitSeconds();
  console.log("✓ 当前时间单位:", unitSeconds.toString(), "秒\n");
  
  // ===== 第一步：记录周期收益 =====
  console.log("【第一步】记录周期收益数据\n");
  
  // 准备测试数据
  const testData = [
    { periodRevenue: hre.ethers.parseEther("100"), timestamp: 1700000000 }, // 2023-11-14
    { periodRevenue: hre.ethers.parseEther("150"), timestamp: 1700003600 }, // +1小时
    { periodRevenue: hre.ethers.parseEther("200"), timestamp: 1700007200 }, // +2小时
    { periodRevenue: hre.ethers.parseEther("250"), timestamp: 1700010800 }, // +3小时
    { periodRevenue: hre.ethers.parseEther("300"), timestamp: 1700014400 }, // +4小时
  ];
  
  // 存储截断后的时间戳
  const truncatedTimestamps = [];
  
  console.log("记录收益数据:");
  for (let i = 0; i < testData.length; i++) {
    const { periodRevenue, timestamp } = testData[i];
    
    // 手动计算截断后的时间戳（与合约逻辑一致）
    const truncated = timestamp - (timestamp % Number(unitSeconds));
    truncatedTimestamps.push(truncated);
    
    const tx = await revenueManager.recordPeriodRevenue(periodRevenue, timestamp);
    await tx.wait();
    
    // 验证数据是否正确记录
    const isRecorded = await revenueManager.isTimestampRecorded(truncated);
    const accumulatedRevenue = await revenueManager.getAccumulatedRevenueAt(truncated);
    
    console.log(`  ${i + 1}. 原始时间戳: ${timestamp}`);
    console.log(`     截断时间戳: ${truncated}`);
    console.log(`     周期收益: ${hre.ethers.formatEther(periodRevenue)} ETH`);
    console.log(`     累计收益: ${hre.ethers.formatEther(accumulatedRevenue)} ETH`);
    console.log(`     已记录: ${isRecorded ? '✓' : '✗'}\n`);
  }
  
  // 获取当前累计总收益
  const totalRevenue = await revenueManager.getCurrentAccumulatedRevenue();
  console.log(`✓ 当前累计总收益: ${hre.ethers.formatEther(totalRevenue)} ETH\n`);
  
  // ===== 第二步：测试查询函数 =====
  console.log("【第二步】测试查询函数\n");
  
  // 测试范围
  const startIndex = truncatedTimestamps[0];
  const endIndex = truncatedTimestamps[truncatedTimestamps.length - 1];
  
  console.log(`查询范围: ${startIndex} ~ ${endIndex}\n`);
  
  // 1. 测试 findMinMarkedIndex
  console.log("1. 测试 findMinMarkedIndex:");
  const [minFound, minIndex] = await revenueManager.findMinMarkedIndex(startIndex, endIndex);
  console.log(`   找到: ${minFound}`);
  console.log(`   最小索引: ${minIndex}`);
  console.log(`   预期值: ${truncatedTimestamps[0]}`);
  console.log(`   结果: ${minIndex.toString() === truncatedTimestamps[0].toString() ? '✓ 正确' : '✗ 错误'}\n`);
  
  // 2. 测试 findMaxMarkedIndex
  console.log("2. 测试 findMaxMarkedIndex:");
  const [maxFound, maxIndex] = await revenueManager.findMaxMarkedIndex(startIndex, endIndex);
  console.log(`   找到: ${maxFound}`);
  console.log(`   最大索引: ${maxIndex}`);
  console.log(`   预期值: ${truncatedTimestamps[truncatedTimestamps.length - 1]}`);
  console.log(`   结果: ${maxIndex.toString() === truncatedTimestamps[truncatedTimestamps.length - 1].toString() ? '✓ 正确' : '✗ 错误'}\n`);
  
  // 3. 测试 findPreviousMarkedIndex
  console.log("3. 测试 findPreviousMarkedIndex:");
  
  // 测试查找第3个时间戳之前的索引（应该返回第2个）
  const targetIndex = truncatedTimestamps[2];
  const expectedPrevious = truncatedTimestamps[1];
  
  const [prevFound, prevIndex] = await revenueManager.findPreviousMarkedIndex(targetIndex);
  console.log(`   目标索引: ${targetIndex}`);
  console.log(`   找到: ${prevFound}`);
  console.log(`   前一个索引: ${prevIndex}`);
  console.log(`   预期值: ${expectedPrevious}`);
  console.log(`   结果: ${prevIndex.toString() === expectedPrevious.toString() ? '✓ 正确' : '✗ 错误'}\n`);
  
  // 4. 额外测试：查找最后一个时间戳之后的前一个（应该返回倒数第二个）
  console.log("4. 测试边界情况 - 查找最后一个时间戳之后的前一个:");
  const lastTimestamp = truncatedTimestamps[truncatedTimestamps.length - 1];
  const targetAfterLast = lastTimestamp + 1000; // 在最后一个时间戳之后
  const expectedBeforeLast = truncatedTimestamps[truncatedTimestamps.length - 1];
  
  const [afterLastFound, afterLastIndex] = await revenueManager.findPreviousMarkedIndex(targetAfterLast);
  console.log(`   目标索引: ${targetAfterLast}`);
  console.log(`   找到: ${afterLastFound}`);
  console.log(`   前一个索引: ${afterLastIndex}`);
  console.log(`   预期值: ${expectedBeforeLast}`);
  console.log(`   结果: ${afterLastIndex.toString() === expectedBeforeLast.toString() ? '✓ 正确' : '✗ 错误'}\n`);
  
  // 5. 测试中间范围查询
  console.log("5. 测试中间范围查询:");
  const midStart = truncatedTimestamps[1];
  const midEnd = truncatedTimestamps[3];
  console.log(`   查询范围: ${midStart} ~ ${midEnd}`);
  
  const [midMinFound, midMinIndex] = await revenueManager.findMinMarkedIndex(midStart, midEnd);
  const [midMaxFound, midMaxIndex] = await revenueManager.findMaxMarkedIndex(midStart, midEnd);
  
  console.log(`   最小索引: ${midMinIndex} (预期: ${truncatedTimestamps[1]})`);
  console.log(`   结果: ${midMinIndex.toString() === truncatedTimestamps[1].toString() ? '✓ 正确' : '✗ 错误'}`);
  console.log(`   最大索引: ${midMaxIndex} (预期: ${truncatedTimestamps[3]})`);
  console.log(`   结果: ${midMaxIndex.toString() === truncatedTimestamps[3].toString() ? '✓ 正确' : '✗ 错误'}\n`);
  
  // ===== 测试总结 =====
  console.log("==== 测试完成 ====");
  console.log("\n测试数据已存储的截断时间戳:");
  truncatedTimestamps.forEach((ts, i) => {
    console.log(`  ${i + 1}. ${ts}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
