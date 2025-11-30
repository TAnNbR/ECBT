const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LiquidateManager 集成测试 (真实 RevenueManager)", function () {
  let liquidateManager;
  let revenueManager;
  let mockCollateralVault;
  let owner, addr1, addr2;

  // 时间常量
  const DAY = 86400;
  const HOUR = 3600;
  const QUARTER_DAYS = 90; // 一个季度90天
  
  // 清算常量
  const LIQUIDATION_PERCENTAGE = 2000; // 20%

  // 季度预期分红（例如 10,000 USDT）
  const QUARTERLY_EXPECTED_DIVIDEND = ethers.parseUnits("10000", 6);

  /**
   * 部署 Mock CollateralVault 合约
   */
  async function deployMockCollateralVault() {
    const MockCollateralVault = await ethers.getContractFactory("MockCollateralVault");
    const mock = await MockCollateralVault.deploy();
    await mock.waitForDeployment();
    return mock;
  }

  beforeEach(async function () {
    // 获取签名者
    [owner, addr1, addr2] = await ethers.getSigners();

    // 部署真实的 RevenueManager 合约
    const RevenueManager = await ethers.getContractFactory("RevenueManager");
    revenueManager = await RevenueManager.deploy();
    await revenueManager.waitForDeployment();

    // 配置 RevenueManager 的时间单位为小时
    await revenueManager.setUnitSeconds(1); // HOUR

    // 部署 Mock CollateralVault
    mockCollateralVault = await deployMockCollateralVault();

    // 部署 LiquidateManager 合约
    const LiquidateManager = await ethers.getContractFactory("LiquidateManager");
    liquidateManager = await LiquidateManager.deploy();
    await liquidateManager.waitForDeployment();

    // 配置 LiquidateManager
    await liquidateManager.setQuarterlyExpectedDividend(QUARTERLY_EXPECTED_DIVIDEND);
    await liquidateManager.setQuarterCycleDays(QUARTER_DAYS);
    await liquidateManager.setRevenueManager(await revenueManager.getAddress());
    await liquidateManager.setCollateralVault(await mockCollateralVault.getAddress());

    console.log("RevenueManager deployed to:", await revenueManager.getAddress());
    console.log("LiquidateManager deployed to:", await liquidateManager.getAddress());
  });

  describe("真实 RevenueManager 集成", function () {
    it("应该能从 RevenueManager 读取累计收益", async function () {
      // 通过 RevenueManager 记录一些收益
      const currentTime = await time.latest();
      
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),
        currentTime
      );

      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("4000", 6),
        await time.latest()
      );

      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );

      // 验证 RevenueManager 的累计收益
      const totalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(totalRevenue).to.equal(ethers.parseUnits("12000", 6));

      // LiquidateManager 检查收益（应该达标）
      await liquidateManager.checkQuarterlyRevenue();

      // 验证没有触发清算
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      expect(await liquidateManager.lastRecordedRevenue()).to.equal(totalRevenue);
      
      // 注意：达标时不会记录到 liquidationTimes，所以数组长度为 0
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });

    it("RevenueManager 收益不足时应触发清算", async function () {
      // 记录不足的收益（总共只有 5000 < 10000）
      const currentTime = await time.latest();
      
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("2000", 6),
        currentTime
      );

      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("1500", 6),
        await time.latest()
      );

      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("1500", 6),
        await time.latest()
      );

      // 验证 RevenueManager 的累计收益
      const totalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(totalRevenue).to.equal(ethers.parseUnits("5000", 6));

      // LiquidateManager 检查收益（应该不达标）
      await liquidateManager.checkQuarterlyRevenue();

      // 验证触发了清算
      expect(await liquidateManager.liquidationCount()).to.equal(1);
      expect(await mockCollateralVault.wasUpdateCalled()).to.be.true;
    });

    it("跨季度累计收益计算应该正确", async function () {
      // ===== 第一季度 =====
      const startTime = await time.latest();
      
      // 记录第一季度的收益（总计 15000，达标）
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), startTime);
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), await time.latest());
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), await time.latest());

      // 第一次检查
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      expect(await liquidateManager.lastRecordedRevenue()).to.equal(ethers.parseUnits("15000", 6));

      // ===== 第二季度 =====
      await time.increase(QUARTER_DAYS * DAY);

      // 记录第二季度的收益（季度收益只有 8000，不达标）
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("3000", 6), await time.latest());
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("2500", 6), await time.latest());
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("2500", 6), await time.latest());

      // 验证累计收益
      const q2TotalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(q2TotalRevenue).to.equal(ethers.parseUnits("23000", 6)); // 15000 + 8000

      // 第二次检查（季度收益 = 23000 - 15000 = 8000 < 10000）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1); // 触发清算

      // ===== 第三季度 =====
      await time.increase(QUARTER_DAYS * DAY);

      // 记录第三季度的收益（季度收益 12000，达标）
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("4000", 6), await time.latest());
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("4000", 6), await time.latest());
      await time.increase(HOUR);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("4000", 6), await time.latest());

      // 验证累计收益
      const q3TotalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(q3TotalRevenue).to.equal(ethers.parseUnits("35000", 6)); // 23000 + 12000

      // 第三次检查（季度收益 = 35000 - 23000 = 12000 >= 10000）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1); // 没有增加
    });

    it("RevenueManager 时间戳截断功能集成测试", async function () {
      // 使用不同的时间戳记录收益，测试截断功能
      const baseTime = await time.latest();
      const truncatedBase = baseTime - (baseTime % HOUR);

      // 在同一小时内记录多次收益
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("2000", 6), baseTime);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("3000", 6), baseTime + 1800); // 30分钟后
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), baseTime + 3000); // 50分钟后

      // 验证累计收益
      const totalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(totalRevenue).to.equal(ethers.parseUnits("10000", 6));

      // 验证截断后的时间戳被标记
      expect(await revenueManager.isTimestampRecorded(truncatedBase)).to.be.true;

      // 验证最终累计收益正确（不是截断时间戳的累计值，而是最新的累计值）
      const finalAccumulated = await revenueManager.getCurrentAccumulatedRevenue();
      expect(finalAccumulated).to.equal(ethers.parseUnits("10000", 6));

      // LiquidateManager 检查（刚好达标）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
    });

    it("多次清算场景下的时间范围查找", async function () {
      // 模拟 4 个季度，其中 3 个不达标
      const revenues = [
        ethers.parseUnits("5000", 6),  // Q1: 不达标
        ethers.parseUnits("7000", 6),  // Q2: 不达标 (季度收益 7000-5000=2000)
        ethers.parseUnits("20000", 6), // Q3: 达标 (季度收益 20000-7000=13000)
        ethers.parseUnits("25000", 6)  // Q4: 不达标 (季度收益 25000-20000=5000)
      ];

      const checkTimes = [];

      for (let i = 0; i < revenues.length; i++) {
        if (i > 0) {
          await time.increase(QUARTER_DAYS * DAY);
        }

        // 记录该季度的收益
        const currentTime = await time.latest();
        const revenueToAdd = i === 0 
          ? revenues[i] 
          : revenues[i] - revenues[i - 1];
        
        await revenueManager.recordPeriodRevenue(revenueToAdd, currentTime);

        // 执行检查
        await liquidateManager.checkQuarterlyRevenue();
        checkTimes.push(await time.latest());
      }

      // 验证清算次数（Q1, Q2, Q4 不达标）
      expect(await liquidateManager.liquidationCount()).to.equal(3);

      // 测试时间范围查找
      const allLiquidationTimes = await liquidateManager.getAllLiquidationTimes();
      expect(allLiquidationTimes.length).to.equal(3);

      // 查找所有清算时间（注意：新的实现只返回 count）
      const count = await liquidateManager.findLiquidationTimeRange(
        checkTimes[0] - DAY,
        checkTimes[3] + DAY
      );

      expect(count).to.equal(3);
    });

    it("零收益场景测试", async function () {
      // 不记录任何收益，直接检查
      await liquidateManager.checkQuarterlyRevenue();

      // 验证：0 收益应该触发清算
      expect(await liquidateManager.liquidationCount()).to.equal(1);
      expect(await revenueManager.lastestAccumulatedRevenue()).to.equal(0);
      
      // 验证清算时间被记录
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(1);
    });

    it("RevenueManager 按天记录收益测试", async function () {
      // 切换到按天记录
      await revenueManager.setUnitSeconds(2); // DAY

      const startTime = await time.latest();
      
      // 连续 90 天，每天记录收益
      const dailyRevenue = ethers.parseUnits("120", 6); // 每天 120 USDT
      
      for (let i = 0; i < 90; i++) {
        await time.increase(DAY);
        await revenueManager.recordPeriodRevenue(
          dailyRevenue,
          await time.latest()
        );
      }

      // 验证累计收益：120 * 90 = 10800 USDT
      const totalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(totalRevenue).to.equal(ethers.parseUnits("10800", 6));

      // LiquidateManager 检查（应该达标）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      
      // 达标时不记录到 liquidationTimes
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });

    it("RevenueManager 索引查找功能集成", async function () {
      const baseTime = await time.latest();
      const truncatedBase = baseTime - (baseTime % HOUR);

      // 记录多个时间点的收益
      for (let i = 0; i < 10; i++) {
        await time.increase(HOUR);
        await revenueManager.recordPeriodRevenue(
          ethers.parseUnits("1000", 6),
          await time.latest()
        );
      }

      // 使用 RevenueManager 的索引查找功能
      const endTime = await time.latest();
      const truncatedEnd = endTime - (endTime % HOUR);

      // 查找最小索引
      const minResult = await revenueManager.findMinMarkedIndex(
        truncatedBase,
        truncatedEnd
      );
      expect(minResult.found).to.be.true;

      // 查找最大索引
      const maxResult = await revenueManager.findMaxMarkedIndex(
        truncatedBase,
        truncatedEnd
      );
      expect(maxResult.found).to.be.true;

      // 查找前一个索引
      const prevResult = await revenueManager.findPreviousMarkedIndex(truncatedEnd);
      expect(prevResult.found).to.be.true;

      // 验证累计收益
      expect(await revenueManager.lastestAccumulatedRevenue()).to.equal(
        ethers.parseUnits("10000", 6)
      );

      // LiquidateManager 检查（达标）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      
      // 达标时不记录到 liquidationTimes
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });

    it("边界情况：收益刚好等于预期", async function () {
      // 记录刚好 10000 的收益
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("10000", 6),
        currentTime
      );

      // 验证
      expect(await revenueManager.lastestAccumulatedRevenue()).to.equal(
        QUARTERLY_EXPECTED_DIVIDEND
      );

      // 检查（应该达标，因为是 >=）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      
      // 达标时不记录到 liquidationTimes
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });

    it("极端情况：超高收益测试", async function () {
      // 记录超高收益
      const highRevenue = ethers.parseUnits("1000000", 6); // 100万 USDT
      const currentTime = await time.latest();
      
      await revenueManager.recordPeriodRevenue(highRevenue, currentTime);

      // 验证
      expect(await revenueManager.lastestAccumulatedRevenue()).to.equal(highRevenue);

      // 检查（远超预期）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      
      // 达标时不记录到 liquidationTimes
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });

    it("连续达标时周期检查行为", async function () {
      // 第一次检查：达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("12000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
      // lastRecordedRevenue = 12000

      // 等待90天后第二次检查
      await time.increase(QUARTER_DAYS * DAY);
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),  // 累计 15000
        await time.latest()
      );
      
      // 第二次检查（季度收益 = 15000 - 12000 = 3000 < 10000，不达标）
      await liquidateManager.checkQuarterlyRevenue();
      
      // 验证不达标
      expect(await liquidateManager.liquidationCount()).to.equal(1);
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(1);
    });

    it("不达标后再达标需要等待周期", async function () {
      // 第一次：不达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1);
      // lastRecordedRevenue = 5000
      
      // 立即尝试第二次检查（应该失败，因为未到周期）
      await expect(
        liquidateManager.checkQuarterlyRevenue()
      ).to.be.revertedWith("Quarter cycle not completed");
      
      // 等待90天后可以检查
      await time.increase(QUARTER_DAYS * DAY);
      
      // 添加足够的收益使达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("10000", 6),  // 累计变成 15000
        await time.latest()
      );
      // 季度收益 = 15000 - 5000 = 10000 >= 10000，达标
      
      await liquidateManager.checkQuarterlyRevenue();
      
      // 第二次达标，清算次数不变
      expect(await liquidateManager.liquidationCount()).to.equal(1);
    });

    it("混合场景：不达标-达标-不达标", async function () {
      // Q1: 不达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1);
      // lastRecordedRevenue = 5000
      
      // 等待90天
      await time.increase(QUARTER_DAYS * DAY);
      
      // Q2: 添加足够收益使达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("10000", 6),  // 累计变成 15000
        await time.latest()
      );
      // 季度收益 = 15000 - 5000 = 10000 >= 10000，达标
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1); // 不增加
      // lastRecordedRevenue = 15000
      
      // 等待90天
      await time.increase(QUARTER_DAYS * DAY);
      
      // Q3: 添加少量收益，不达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),  // 累计变成 18000
        await time.latest()
      );
      // 季度收益 = 18000 - 15000 = 3000 < 10000，不达标
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(2);
      
      // 验证 liquidationTimes 长度（Q1和Q3的不达标记录）
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(2);
    });
  });

  describe("RevenueManager 与 CollateralVault 的完整流程", function () {
    it("不达标时应该正确调用 CollateralVault", async function () {
      // 记录不足的收益
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),
        currentTime
      );

      // 重置 mock 状态
      await mockCollateralVault.resetMock();

      // 执行检查
      await liquidateManager.checkQuarterlyRevenue();

      // 验证 CollateralVault 被调用
      expect(await mockCollateralVault.wasUpdateCalled()).to.be.true;
      expect(await mockCollateralVault.getLastUpdatePercentage()).to.equal(
        LIQUIDATION_PERCENTAGE
      );
    });

    it("达标时不应该调用 CollateralVault 的 updateLiquidatableCollateral", async function () {
      // 记录足够的收益
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("15000", 6),
        currentTime
      );

      // 重置 mock 状态
      await mockCollateralVault.resetMock();

      // 执行检查
      await liquidateManager.checkQuarterlyRevenue();

      // 验证 CollateralVault 的 updateLiquidatableCollateral 没有被调用
      expect(await mockCollateralVault.wasUpdateCalled()).to.be.false;
      
      // 验证达标时不记录到 liquidationTimes
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });
  });

  describe("性能和 Gas 测试", function () {
    it("处理大量收益记录后的检查", async function () {
      const currentTime = await time.latest();
      
      // 记录 100 次收益
      for (let i = 0; i < 100; i++) {
        await time.increase(HOUR);
        await revenueManager.recordPeriodRevenue(
          ethers.parseUnits("100", 6),
          await time.latest()
        );
      }

      // 验证累计收益
      const totalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(totalRevenue).to.equal(ethers.parseUnits("10000", 6));

      // 执行检查
      const tx = await liquidateManager.checkQuarterlyRevenue();
      const receipt = await tx.wait();
      
      console.log(`      Gas used for check after 100 records: ${receipt.gasUsed}`);

      // 验证结果（达标）
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });
  });

  describe("事件验证", function () {
    it("不达标时应该触发 LiquidationTriggered 事件", async function () {
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        currentTime
      );

      // 监听事件（不验证精确时间戳，因为交易执行时间可能有微小差异）
      const tx = await liquidateManager.checkQuarterlyRevenue();
      const receipt = await tx.wait();
      
      // 从事件中提取数据
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'LiquidationTriggered'
      );
      
      expect(event).to.not.be.undefined;
      // 验证清算次数参数
      expect(event.args[1]).to.equal(1);
    });

    it("应该触发 QuarterlyRevenueChecked 事件", async function () {
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("12000", 6),
        currentTime
      );

      // 监听事件
      await expect(liquidateManager.checkQuarterlyRevenue())
        .to.emit(liquidateManager, "QuarterlyRevenueChecked");
    });

    it("QuarterlyRevenueChecked 事件应包含正确的参数", async function () {
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("12000", 6),
        currentTime
      );

      const tx = await liquidateManager.checkQuarterlyRevenue();
      const receipt = await tx.wait();
      
      // 查找事件
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'QuarterlyRevenueChecked'
      );
      
      expect(event).to.not.be.undefined;
      // 验证事件参数：meetsExpectation, actualRevenue, expectedRevenue
      expect(event.args[1]).to.be.true; // meetsExpectation
      expect(event.args[2]).to.equal(ethers.parseUnits("12000", 6)); // actualRevenue
      expect(event.args[3]).to.equal(QUARTERLY_EXPECTED_DIVIDEND); // expectedRevenue
    });
  });
});

