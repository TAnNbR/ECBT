const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LiquidateManager 集成测试 (真实合约)", function () {
  let liquidateManager;
  let revenueManager;
  let collateralVault;
  let paymentToken; // Mock USDT
  let owner, addr1, addr2;

  // 时间常量
  const DAY = 86400;
  const HOUR = 3600;
  const QUARTER_DAYS = 7; // 一个季度90天
  
  // 清算常量
  const LIQUIDATION_PERCENTAGE = 2000; // 20%

  // 季度预期分红（例如 10,000 USDT）
  const QUARTERLY_EXPECTED_DIVIDEND = ethers.parseUnits("10000", 6);

  beforeEach(async function () {
    // 获取签名者
    [owner, addr1, addr2] = await ethers.getSigners();

    // 1. 部署 Mock ERC20 代币（模拟 USDT）
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await paymentToken.waitForDeployment();

    // 给账户铸造一些代币用于测试
    await paymentToken.mint(owner.address, ethers.parseUnits("1000000", 6));
    await paymentToken.mint(addr1.address, ethers.parseUnits("1000000", 6));

    // 2. 部署真实的 CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    collateralVault = await CollateralVault.deploy(await paymentToken.getAddress());
    await collateralVault.waitForDeployment();

    // 3. 部署真实的 RevenueManager 合约
    const RevenueManager = await ethers.getContractFactory("RevenueManager");
    revenueManager = await RevenueManager.deploy();
    await revenueManager.waitForDeployment();

    // 配置 RevenueManager 的时间单位为小时
    await revenueManager.setUnitSeconds(1); // HOUR

    // 4. 部署 LiquidateManager 合约
    const LiquidateManager = await ethers.getContractFactory("LiquidateManager");
    liquidateManager = await LiquidateManager.deploy();
    await liquidateManager.waitForDeployment();

    // 配置 LiquidateManager
    await liquidateManager.setQuarterlyExpectedDividend(QUARTERLY_EXPECTED_DIVIDEND);
    await liquidateManager.setQuarterCycleDays(QUARTER_DAYS);
    await liquidateManager.setRevenueManager(await revenueManager.getAddress());
    await liquidateManager.setCollateralVault(await collateralVault.getAddress());

    // 5. 存入一些抵押金用于测试清算
    const collateralAmount = ethers.parseUnits("100000", 6); // 100,000 USDT
    await paymentToken.approve(await collateralVault.getAddress(), collateralAmount);
    await collateralVault.depositCollateralByProvider(collateralAmount);
  });

  describe("清算周期测试", function () {
    it("一次清算周期达标", async function () {
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

    it("一次清算周期不达标", async function () {
      // 记录清算前的可清算金额
      const liquidatableBefore = await collateralVault.liquidatableCollateralAmount();
      
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
      
      // 验证 CollateralVault 的可清算金额增加了
      const liquidatableAfter = await collateralVault.liquidatableCollateralAmount();
      const expectedIncrease = ethers.parseUnits("100000", 6) * BigInt(LIQUIDATION_PERCENTAGE) / 10000n;
      expect(liquidatableAfter - liquidatableBefore).to.equal(expectedIncrease);
    });

    it("多清算周期", async function () {
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

    it("一天内多次记录收益", async function () {
      // 切换到按天记录
      await revenueManager.setUnitSeconds(1); // DAY

      const startTime = await time.latest();
      
      const dailyRevenue = ethers.parseUnits("1000", 6); // 每小时 1000 USDT
      
      for (let i = 0; i < 15; i++) {
        await time.increase(HOUR);
        await revenueManager.recordPeriodRevenue(
          dailyRevenue,
          await time.latest()
        );
      }

      // 验证累计收益：120 * 90 = 10800 USDT
      const totalRevenue = await revenueManager.lastestAccumulatedRevenue();
      expect(totalRevenue).to.equal(ethers.parseUnits("15000", 6));

      // LiquidateManager 检查（应该达标）
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      
      // 达标时不记录到 liquidationTimes
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
    });

    it("收益刚好等于预期", async function () {
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

    it("清算需要等待周期", async function () {
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
    });
  });

  describe("测试 CollateralVault", function () {
    it("不达标时应该正确更新 CollateralVault 的可清算金额", async function () {
      // 记录清算前的状态
      const liquidatableBefore = await collateralVault.liquidatableCollateralAmount();
      const totalCollateral = await collateralVault.totalCollateralAmount();
      
      // 记录不足的收益
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),
        currentTime
      );
      
      // 执行检查
      await liquidateManager.checkQuarterlyRevenue();

      // 验证 CollateralVault 的可清算金额增加
      const liquidatableAfter = await collateralVault.liquidatableCollateralAmount();
      const expectedIncrease = totalCollateral * BigInt(LIQUIDATION_PERCENTAGE) / 10000n;
      expect(liquidatableAfter - liquidatableBefore).to.equal(expectedIncrease);
      
      // 验证清算次数
      expect(await liquidateManager.liquidationCount()).to.equal(1);
    });

    it("达标时不应该更新 CollateralVault 的可清算金额", async function () {
      // 记录清算前的状态
      const liquidatableBefore = await collateralVault.liquidatableCollateralAmount();
      
      // 记录足够的收益
      const currentTime = await time.latest();
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("15000", 6),
        currentTime
      );

      // 执行检查
      await liquidateManager.checkQuarterlyRevenue();

      // 验证 CollateralVault 的可清算金额没有变化
      const liquidatableAfter = await collateralVault.liquidatableCollateralAmount();
      expect(liquidatableAfter).to.equal(liquidatableBefore);
      
      // 验证达标时不记录到 liquidationTimes
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(0);
      
      // 验证清算次数为 0
      expect(await liquidateManager.liquidationCount()).to.equal(0);
    });

    it("多次清算应该累计可清算金额", async function () {
      const totalCollateral = await collateralVault.totalCollateralAmount();
      const liquidatableBefore = await collateralVault.liquidatableCollateralAmount();
      
      // 第一次不达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 等待7天
      await time.increase(QUARTER_DAYS * DAY);
      
      // 第二次不达标
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 验证累计了两次清算
      const liquidatableAfter = await collateralVault.liquidatableCollateralAmount();
      const expectedIncrease = totalCollateral * BigInt(LIQUIDATION_PERCENTAGE) / 10000n * 2n;
      expect(liquidatableAfter - liquidatableBefore).to.equal(expectedIncrease);
      
      // 验证清算次数
      expect(await liquidateManager.liquidationCount()).to.equal(2);
    });

    it("应该能够从 CollateralVault 转出清算金", async function () {
      // 触发一次清算
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 验证可清算金额增加
      const liquidatableAmount = await collateralVault.liquidatableCollateralAmount();
      expect(liquidatableAmount).to.be.greaterThan(0);
      
      // 模拟转出清算金（10% 份额，1 次清算）
      const totalShares = ethers.parseUnits("1000000", 18);
      const holderShares = ethers.parseUnits("100000", 18); // 10%
      const liquidationCount = 1;
      
      const recipientBefore = await paymentToken.balanceOf(addr1.address);
      
      await collateralVault.transferLiquidatableCollateral(
        addr1.address,
        holderShares,
        totalShares,
        liquidationCount
      );
      
      const recipientAfter = await paymentToken.balanceOf(addr1.address);
      const received = recipientAfter - recipientBefore;
      
      // 验证收到了正确的清算金
      const totalCollateral = await collateralVault.totalCollateralAmount();
      const expectedAmount = totalCollateral * BigInt(LIQUIDATION_PERCENTAGE) / 10000n * holderShares / totalShares;
      expect(received).to.equal(expectedAmount);
    });
  });

  describe("findLiquidationTimeRange 函数测试", function () {
    it("单次清算在时间范围内", async function () {
      // 记录一次不达标（触发清算）
      const beforeLiquidation = await time.latest();
      
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();

      // 验证清算次数
      expect(await liquidateManager.liquidationCount()).to.equal(1);
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(1);
      
      // 查找从 beforeLiquidation 开始的一个季度周期内的清算次数
      const count = await liquidateManager.findLiquidationTimeRange(beforeLiquidation);
      
      expect(count).to.equal(1);
    });

    it("多次清算在时间范围内", async function () {
      const startTime = await time.latest();
      
      // 第一次清算
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();

      // 等待完整的一个季度周期
      await time.increase(QUARTER_DAYS * DAY);

      // 第二次清算
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();

      // 验证总清算次数
      expect(await liquidateManager.liquidationCount()).to.equal(2);
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(2);
      
      // 从 startTime 查找，应该包含所有 >= startTime 的清算（两次）
      const count = await liquidateManager.findLiquidationTimeRange(startTime);
      
      expect(count).to.equal(2);
    });

    it("应该在没有清算时返回 0", async function () {
      // 记录达标收益（不触发清算）
      const startTime = await time.latest();
      
        await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("15000", 6),
          await time.latest()
        );
      await liquidateManager.checkQuarterlyRevenue();

      // 验证没有清算
      expect(await liquidateManager.liquidationCount()).to.equal(0);
      
      // 查找时间范围应该返回 0
      const count = await liquidateManager.findLiquidationTimeRange(startTime);
      
      expect(count).to.equal(0);
    });

    it("holdTime 等于清算时间", async function () {
      // 触发清算
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 获取清算时间
      const liquidationTimes = await liquidateManager.getAllLiquidationTimes();
      const liquidationTime = liquidationTimes[0];
      
      // 使用清算时间作为 holdTime（边界情况）
      const count = await liquidateManager.findLiquidationTimeRange(liquidationTime);
      
      // 应该包含这次清算（因为条件是 >=）
      expect(count).to.equal(1);
    });

    it("holdTime 在清算时间之后", async function () {
      // 触发清算
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 等待一段时间后查找
      await time.increase(DAY * 10);
      const laterTime = await time.latest();
      
      // 从清算之后的时间开始查找（应该找不到）
      const count = await liquidateManager.findLiquidationTimeRange(laterTime);
      
      expect(count).to.equal(0);
    });

    it("holdTime 在多个清算时间的中间", async function () {
      // 第一次清算
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("5000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 等待一段时间并记录中间时间点
      await time.increase(QUARTER_DAYS * DAY);
      const middleTime = await time.latest();
      
      // 第二次清算
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("3000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 等待再触发第三次清算
      await time.increase(QUARTER_DAYS * DAY);
      await revenueManager.recordPeriodRevenue(
        ethers.parseUnits("4000", 6),
        await time.latest()
      );
      await liquidateManager.checkQuarterlyRevenue();
      
      // 验证总清算次数
      expect(await liquidateManager.liquidationCount()).to.equal(3);
      expect(await liquidateManager.getLiquidationTimesLength()).to.equal(3);
      
      // 从 middleTime 查找，应该只包含第二次和第三次清算（第一次在 middleTime 之前）
      const count = await liquidateManager.findLiquidationTimeRange(middleTime);
      
      expect(count).to.equal(2); // 第一次清算在 middleTime 之前，不统计
    });
  });

});

