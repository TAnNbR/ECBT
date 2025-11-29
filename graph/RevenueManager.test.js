const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RevenueManager", function () {
  let revenueManager;
  let owner, addr1, addr2;

  // 时间单位常量
  const MINUTE = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const WEEK = 604800;

  // TimeUnit 枚举
  const TimeUnit = {
    MINUTE: 0,
    HOUR: 1,
    DAY: 2,
    WEEK: 3
  };

  beforeEach(async function () {
    // 获取签名者
    [owner, addr1, addr2] = await ethers.getSigners();

    // 部署 RevenueManager 合约
    const RevenueManager = await ethers.getContractFactory("RevenueManager");
    revenueManager = await RevenueManager.deploy();
    await revenueManager.waitForDeployment();

    console.log("RevenueManager deployed to:", await revenueManager.getAddress());
  });

  describe("时间单位设置", function () {
    it("应该能够设置时间单位为 MINUTE", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.MINUTE);
      expect(await revenueManager.getUnitSeconds()).to.equal(MINUTE);
    });

    it("应该能够设置时间单位为 HOUR", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
      expect(await revenueManager.getUnitSeconds()).to.equal(HOUR);
    });

    it("应该能够设置时间单位为 DAY", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.DAY);
      expect(await revenueManager.getUnitSeconds()).to.equal(DAY);
    });

    it("应该能够设置时间单位为 WEEK", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.WEEK);
      expect(await revenueManager.getUnitSeconds()).to.equal(WEEK);
    });

    it("应该拒绝无效的时间单位", async function () {
      await expect(
        revenueManager.setUnitSeconds(999)
      ).to.be.revertedWith("Invalid time unit");
    });
  });

  describe("记录周期收益", function () {
    beforeEach(async function () {
      // 设置时间单位为小时
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
    });

    it("应该能够记录单笔收益", async function () {
      const revenue = ethers.parseUnits("1000", 6); // 1000 USDT
      const timestamp = await time.latest();

      await revenueManager.recordPeriodRevenue(revenue, timestamp);

      // 验证累计收益
      expect(await revenueManager.getCurrentAccumulatedRevenue()).to.equal(revenue);
    });

    it("应该能够累加多笔收益", async function () {
      const revenue1 = ethers.parseUnits("1000", 6);
      const revenue2 = ethers.parseUnits("500", 6);
      const revenue3 = ethers.parseUnits("750", 6);
      
      const timestamp1 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenue1, timestamp1);

      await time.increase(HOUR);
      const timestamp2 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenue2, timestamp2);

      await time.increase(HOUR);
      const timestamp3 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenue3, timestamp3);

      // 验证总累计收益
      const totalRevenue = revenue1 + revenue2 + revenue3;
      expect(await revenueManager.getCurrentAccumulatedRevenue()).to.equal(totalRevenue);
    });

    it("应该正确截断时间戳（按小时）", async function () {
      // 设置一个非整点时间戳：2024-01-01 10:30:45
      const timestamp = 1704103845; // 包含分钟和秒
      const revenue = ethers.parseUnits("100", 6);

      await revenueManager.recordPeriodRevenue(revenue, timestamp);

      // 计算预期的截断时间戳（应该是 10:00:00）
      const expectedTruncated = timestamp - (timestamp % HOUR);
      
      // 验证该时间戳已被记录
      expect(await revenueManager.isTimestampRecorded(expectedTruncated)).to.be.true;
      
      // 验证可以查询到累计收益
      expect(await revenueManager.getAccumulatedRevenueAt(expectedTruncated)).to.equal(revenue);
    });

    it("应该正确截断时间戳（按天）", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.DAY);
      
      // 设置一个非午夜时间戳
      const timestamp = 1704103845; // 某天的10:30:45
      const revenue = ethers.parseUnits("100", 6);

      await revenueManager.recordPeriodRevenue(revenue, timestamp);

      // 计算预期的截断时间戳（应该是当天的00:00:00）
      const expectedTruncated = timestamp - (timestamp % DAY);
      
      expect(await revenueManager.isTimestampRecorded(expectedTruncated)).to.be.true;
      expect(await revenueManager.getAccumulatedRevenueAt(expectedTruncated)).to.equal(revenue);
    });
  });

  describe("时间戳查询", function () {
    beforeEach(async function () {
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
    });

    it("未记录的时间戳应返回 false", async function () {
      const timestamp = await time.latest();
      expect(await revenueManager.isTimestampRecorded(timestamp)).to.be.false;
    });

    it("已记录的时间戳应返回 true", async function () {
      const revenue = ethers.parseUnits("100", 6);
      const timestamp = await time.latest();
      
      await revenueManager.recordPeriodRevenue(revenue, timestamp);
      
      const truncatedTimestamp = timestamp - (timestamp % HOUR);
      expect(await revenueManager.isTimestampRecorded(truncatedTimestamp)).to.be.true;
    });

    it("应该能查询特定时间戳的累计收益", async function () {
      const revenue1 = ethers.parseUnits("1000", 6);
      const revenue2 = ethers.parseUnits("500", 6);
      
      const timestamp1 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenue1, timestamp1);
      const truncated1 = timestamp1 - (timestamp1 % HOUR);

      await time.increase(HOUR);
      const timestamp2 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenue2, timestamp2);
      const truncated2 = timestamp2 - (timestamp2 % HOUR);

      // 第一个时间戳的累计收益应该是 revenue1
      expect(await revenueManager.getAccumulatedRevenueAt(truncated1)).to.equal(revenue1);
      
      // 第二个时间戳的累计收益应该是 revenue1 + revenue2
      expect(await revenueManager.getAccumulatedRevenueAt(truncated2)).to.equal(revenue1 + revenue2);
    });
  });

  describe("索引查找功能", function () {
    beforeEach(async function () {
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
      
      // 记录多个时间点的收益
      const baseTime = await time.latest();
      const baseTimeTruncated = baseTime - (baseTime % HOUR);
      
      // 在不同时间记录收益
      for (let i = 0; i < 5; i++) {
        const timestamp = baseTimeTruncated + (i * HOUR);
        const revenue = ethers.parseUnits((100 * (i + 1)).toString(), 6);
        await revenueManager.recordPeriodRevenue(revenue, timestamp);
      }
    });

    it("应该能找到范围内的最小索引", async function () {
      const baseTime = await time.latest();
      const baseTimeTruncated = baseTime - (baseTime % HOUR);
      
      const startIndex = baseTimeTruncated;
      const endIndex = baseTimeTruncated + (10 * HOUR);
      
      const result = await revenueManager.findMinMarkedIndex(startIndex, endIndex);
      
      expect(result.found).to.be.true;
      expect(result.minIndex).to.equal(baseTimeTruncated);
    });

    it("应该能找到范围内的最大索引", async function () {
      const baseTime = await time.latest();
      const baseTimeTruncated = baseTime - (baseTime % HOUR);
      
      const startIndex = baseTimeTruncated;
      const endIndex = baseTimeTruncated + (10 * HOUR);
      
      const result = await revenueManager.findMaxMarkedIndex(startIndex, endIndex);
      
      expect(result.found).to.be.true;
      expect(result.maxIndex).to.equal(baseTimeTruncated + (4 * HOUR));
    });

    it("应该能找到目标索引之前最近的索引", async function () {
      const baseTime = await time.latest();
      const baseTimeTruncated = baseTime - (baseTime % HOUR);
      
      // 查找第3小时和第4小时之间的时间点
      const targetIndex = baseTimeTruncated + (3.5 * HOUR);
      
      const result = await revenueManager.findPreviousMarkedIndex(targetIndex);
      
      expect(result.found).to.be.true;
      expect(result.previousIndex).to.equal(baseTimeTruncated + (3 * HOUR));
    });

    it("空范围应该返回 found=false", async function () {
      const futureTime = (await time.latest()) + (100 * HOUR);
      
      const result = await revenueManager.findMinMarkedIndex(futureTime, futureTime + HOUR);
      
      expect(result.found).to.be.false;
    });
  });

  describe("累计收益计算", function () {
    beforeEach(async function () {
      await revenueManager.setUnitSeconds(TimeUnit.DAY);
    });

    it("应该正确累加每日收益", async function () {
      const dailyRevenues = [
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("1500", 6),
        ethers.parseUnits("2000", 6),
        ethers.parseUnits("1200", 6),
        ethers.parseUnits("1800", 6)
      ];

      let expectedTotal = 0n;
      const baseTime = await time.latest();
      const baseTimeTruncated = baseTime - (baseTime % DAY);

      for (let i = 0; i < dailyRevenues.length; i++) {
        const timestamp = baseTimeTruncated + (i * DAY);
        await revenueManager.recordPeriodRevenue(dailyRevenues[i], timestamp);
        
        expectedTotal += dailyRevenues[i];
        
        // 验证每次记录后的累计收益
        expect(await revenueManager.getCurrentAccumulatedRevenue()).to.equal(expectedTotal);
        
        // 验证该时间点的累计收益
        expect(await revenueManager.getAccumulatedRevenueAt(timestamp)).to.equal(expectedTotal);
      }
    });

    it("应该能计算两个时间点之间的收益", async function () {
      const revenue1 = ethers.parseUnits("1000", 6);
      const revenue2 = ethers.parseUnits("500", 6);
      const revenue3 = ethers.parseUnits("750", 6);

      const baseTime = await time.latest();
      const baseTimeTruncated = baseTime - (baseTime % DAY);

      const time1 = baseTimeTruncated;
      const time2 = baseTimeTruncated + DAY;
      const time3 = baseTimeTruncated + (2 * DAY);

      await revenueManager.recordPeriodRevenue(revenue1, time1);
      await revenueManager.recordPeriodRevenue(revenue2, time2);
      await revenueManager.recordPeriodRevenue(revenue3, time3);

      // 获取 time1 和 time3 的累计收益
      const accumulatedAtTime1 = await revenueManager.getAccumulatedRevenueAt(time1);
      const accumulatedAtTime3 = await revenueManager.getAccumulatedRevenueAt(time3);

      // time1 到 time3 之间的收益应该是 revenue2 + revenue3
      const periodRevenue = accumulatedAtTime3 - accumulatedAtTime1;
      expect(periodRevenue).to.equal(revenue2 + revenue3);
    });
  });

  describe("边界情况测试", function () {
    it("应该能处理零收益", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
      const timestamp = await time.latest();
      
      await revenueManager.recordPeriodRevenue(0, timestamp);
      
      expect(await revenueManager.getCurrentAccumulatedRevenue()).to.equal(0);
    });

    it("应该能处理极大的收益值", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
      const largeRevenue = ethers.parseUnits("1000000000", 6); // 10亿 USDT
      const timestamp = await time.latest();
      
      await revenueManager.recordPeriodRevenue(largeRevenue, timestamp);
      
      expect(await revenueManager.getCurrentAccumulatedRevenue()).to.equal(largeRevenue);
    });

    it("应该能处理同一小时内的多次记录", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
      const revenue1 = ethers.parseUnits("100", 6);
      const revenue2 = ethers.parseUnits("200", 6);
      
      const timestamp1 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenue1, timestamp1);
      
      // 在同一小时内再次记录（时间戳会被截断到同一小时）
      const timestamp2 = timestamp1 + 1800; // 30分钟后
      await revenueManager.recordPeriodRevenue(revenue2, timestamp2);
      
      // 累计收益应该是两次之和
      expect(await revenueManager.getCurrentAccumulatedRevenue()).to.equal(revenue1 + revenue2);
      
      // 但截断后的时间戳应该相同，所以后面的记录会覆盖前面的累计值
      const truncated = timestamp1 - (timestamp1 % HOUR);
      expect(await revenueManager.getAccumulatedRevenueAt(truncated)).to.equal(revenue1 + revenue2);
    });
  });

  describe("CollateralVault 集成（模拟）", function () {
    it("当设置了 CollateralVault 地址后应该能调用更新", async function () {
      // 部署一个模拟的 CollateralVault（这里只是设置地址，不真正调用）
      // 在实际测试中，如果没有真实的 CollateralVault，这个调用会失败
      // 但我们可以测试地址设置和基本流程
      
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
      const revenue = ethers.parseUnits("100", 6);
      const timestamp = await time.latest();
      
      // 即使没有设置 collateralVault，recordPeriodRevenue 也应该能工作
      await expect(
        revenueManager.recordPeriodRevenue(revenue, timestamp)
      ).to.not.be.reverted;
    });
  });

  describe("性能和 Gas 测试", function () {
    it("应该能高效记录连续的收益", async function () {
      await revenueManager.setUnitSeconds(TimeUnit.HOUR);
      const baseTime = await time.latest();
      const baseTimeTruncated = baseTime - (baseTime % HOUR);
      
      const startGas = await ethers.provider.getBalance(owner.address);
      
      // 记录100个时间点的收益
      for (let i = 0; i < 100; i++) {
        const timestamp = baseTimeTruncated + (i * HOUR);
        const revenue = ethers.parseUnits("100", 6);
        await revenueManager.recordPeriodRevenue(revenue, timestamp);
      }
      
      const endGas = await ethers.provider.getBalance(owner.address);
      console.log(`      Gas used for 100 records: ${startGas - endGas} wei`);
      
      // 验证最终累计收益
      const expectedTotal = ethers.parseUnits("10000", 6); // 100 * 100
      expect(await revenueManager.getCurrentAccumulatedRevenue()).to.equal(expectedTotal);
    });
  });
});

