const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AssetToken _calculateDividendAmount 函数测试 (真实 RevenueManager)", function () {
  let assetTokenHelper;
  let revenueManager;
  let collateralVault;
  let paymentToken;
  let owner, provider;

  // 测试参数
  const MAX_TOTAL_SUPPLY = ethers.parseUnits("1000000", 18); // 100万代币
  const HOLDER_SHARES = ethers.parseUnits("10000", 18); // 持有者持有 10000 代币 (1%)
  
  // 时间常量
  const DAY = 86400;
  const HOUR = 3600;

  beforeEach(async function () {
    [owner, provider] = await ethers.getSigners();

    // 1. 部署 Mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await paymentToken.waitForDeployment();

    // 2. 部署 CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    collateralVault = await CollateralVault.deploy(await paymentToken.getAddress());
    await collateralVault.waitForDeployment();

    // 3. 部署真实的 RevenueManager
    const RevenueManager = await ethers.getContractFactory("RevenueManager");
    revenueManager = await RevenueManager.deploy();
    await revenueManager.waitForDeployment();

    // 配置 RevenueManager - 使用 DAY 单位
    await revenueManager.setUnitSeconds(2); // DAY

    // 4. 部署 AssetTokenTestHelper
    const AssetTokenTestHelper = await ethers.getContractFactory("AssetTokenTestHelper");
    assetTokenHelper = await AssetTokenTestHelper.deploy();
    await assetTokenHelper.waitForDeployment();

    // 5. 初始化 AssetToken
    const metadata = {
      name: "Test Token",
      symbol: "TEST",
      totalValue: ethers.parseUnits("1000000", 6),
      fundraiseAmount: ethers.parseUnits("500000", 6),
      maxTotalSupply: MAX_TOTAL_SUPPLY,
      specialPurposeVehicle: owner.address,
      provider: provider.address,
      createdAt: await ethers.provider.getBlock('latest').then(b => b.timestamp)
    };

    await assetTokenHelper.initialize(
      metadata,
      await paymentToken.getAddress(),
      await collateralVault.getAddress(),
      await revenueManager.getAddress()
    );

    // 6. 购买全部代币以触发售罄（设置 soldOutTimestamp）
    // 这是使用 onlySoldOut 修饰符的前提条件
    const totalPayment = ethers.parseUnits("500000", 6); // 全部募集金额
    await paymentToken.mint(owner.address, totalPayment);
    await paymentToken.approve(await assetTokenHelper.getAddress(), totalPayment);
    await assetTokenHelper.purchase(MAX_TOTAL_SUPPLY);

    // 验证已售罄
    const soldOutTime = await assetTokenHelper.soldOutTimestamp();
    expect(soldOutTime).to.be.greaterThan(0);

    console.log("RevenueManager deployed to:", await revenueManager.getAddress());
    console.log("AssetTokenTestHelper deployed to:", await assetTokenHelper.getAddress());
    console.log("Sold out timestamp:", soldOutTime.toString());
  });

  describe("基本功能测试", function () {
    it("应该在没有收益记录时返回 0", async function () {
      // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();
      
      // 等待一段时间后设置 lastDividendTime（必须 >= soldOutTimestamp）
      await time.increase(DAY * 5);
      const lastDividendTime = await time.latest();
      
      await time.increase(DAY * 5);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 因为没有记录任何收益，应该返回 0
      expect(result).to.equal(0);
    });

    it("当 withdrawTime <= lastDividendTime 时应该返回 0", async function () {
      await time.increase(DAY * 5);
      const currentTime = await time.latest();
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        currentTime,
        currentTime - 1, // withdrawTime < lastDividendTime
        HOLDER_SHARES
      );

      expect(result).to.equal(0);
    });

    it("当 withdrawTime = lastDividendTime 时应该返回 0", async function () {
      await time.increase(DAY * 5);
      const currentTime = await time.latest();
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        currentTime,
        currentTime, // 相等
        HOLDER_SHARES
      );

      expect(result).to.equal(0);
    });

    it("当 revenueManager 未设置时应该返回 0", async function () {
      // 部署新的 AssetTokenTestHelper 不设置 revenueManager
      const AssetTokenTestHelper = await ethers.getContractFactory("AssetTokenTestHelper");
      const newHelper = await AssetTokenTestHelper.deploy();
      await newHelper.waitForDeployment();

      const metadata = {
        name: "Test",
        symbol: "TST",
        totalValue: ethers.parseUnits("1000000", 6),
        fundraiseAmount: ethers.parseUnits("500000", 6),
        maxTotalSupply: MAX_TOTAL_SUPPLY,
        specialPurposeVehicle: owner.address,
        provider: provider.address,
        createdAt: await time.latest()
      };

      await newHelper.initialize(
        metadata,
        await paymentToken.getAddress(),
        await collateralVault.getAddress(),
        ethers.ZeroAddress // 不设置 revenueManager
      );

      // 购买全部代币以触发售罄
      const totalPayment = ethers.parseUnits("500000", 6);
      await paymentToken.mint(provider.address, totalPayment);
      await paymentToken.connect(provider).approve(await newHelper.getAddress(), totalPayment);
      await newHelper.connect(provider).purchase(MAX_TOTAL_SUPPLY);

      // 等待时间
      await time.increase(DAY * 5);
      const lastDividendTime = await time.latest();
      
      await time.increase(DAY * 5);
      const withdrawTime = await time.latest();

      const result = await newHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      expect(result).to.equal(0);
    });
  });

  describe("单笔收益计算", function () {
    it("应该正确计算单笔收益的分红", async function () {
      // 1. 售罄后等待一段时间作为起始时间
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY * 1);

      // 2. 记录一笔收益
      const revenueAmount = ethers.parseUnits("10000", 6); // 10000 USDT
      const revenueTime = await time.latest();
      await revenueManager.recordPeriodRevenue(revenueAmount, revenueTime);

      // 3. 再前进一些时间
      await time.increase(DAY * 2);
      const withdrawTime = await time.latest();

      // 4. 计算分红
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 期望：10000 USDT * (10000 / 1000000) = 100 USDT
      const expectedDividend = (revenueAmount * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expectedDividend);
    });

    it("应该正确处理持有者份额占比", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      const revenueAmount = ethers.parseUnits("10000", 6);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      // 测试不同份额
      const testCases = [
        { shares: ethers.parseUnits("1000", 18), percentage: "0.1%" },   // 0.1%
        { shares: ethers.parseUnits("10000", 18), percentage: "1%" },    // 1%
        { shares: ethers.parseUnits("100000", 18), percentage: "10%" },  // 10%
        { shares: ethers.parseUnits("500000", 18), percentage: "50%" },  // 50%
      ];

      for (const testCase of testCases) {
        const result = await assetTokenHelper.calculateDividendAmountPublic(
          startTime,
          withdrawTime,
          testCase.shares
        );

        const expected = (revenueAmount * testCase.shares) / MAX_TOTAL_SUPPLY;
        expect(result).to.equal(expected);
        
        console.log(`  ${testCase.percentage}: ${ethers.formatUnits(result, 6)} USDT`);
      }
    });

    it("lastDividendTime 在收益记录之后应该返回 0", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      
      // 1. 先记录收益
      const revenueTime = await time.latest();
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), revenueTime);

      // 2. lastDividendTime 在收益之后
      await time.increase(DAY);
      const lastDividendTime = await time.latest();
      
      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 因为 lastDividendTime 在收益记录之后，所以没有新收益
      expect(result).to.equal(0);
    });
  });

  describe("多笔收益计算", function () {
    it("应该累计多笔收益", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      // 记录第一笔收益
      const revenue1 = ethers.parseUnits("5000", 6);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY);

      // 记录第二笔收益
      const revenue2 = ethers.parseUnits("3000", 6);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY);

      // 记录第三笔收益
      const revenue3 = ethers.parseUnits("2000", 6);
      await revenueManager.recordPeriodRevenue(revenue3, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 期望：(5000 + 3000 + 2000) * 1% = 100 USDT
      const totalRevenue = revenue1 + revenue2 + revenue3;
      const expected = (totalRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });

    it("应该只计算时间范围内的收益", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      
      // 记录第一笔收益（在范围外，但在售罄后）
      await time.increase(DAY);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), await time.latest());

      await time.increase(DAY * 3);
      const startTime = await time.latest(); // 从这里开始计算

      await time.increase(DAY);
      
      // 记录第二笔收益（在范围内）
      const revenue2 = ethers.parseUnits("3000", 6);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 只应该计算 revenue2
      const expected = (revenue2 * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });

    it("连续多天记录收益应该正确累计", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
      const days = 7; // 7天

      for (let i = 0; i < days; i++) {
        await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
        await time.increase(DAY);
      }

      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 7天总收益: 7000 USDT * 1% = 70 USDT
      const totalRevenue = dailyRevenue * BigInt(days);
      const expected = (totalRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
      
      console.log(`  7天累计分红: ${ethers.formatUnits(result, 6)} USDT`);
    });
  });

  describe("时间边界测试", function () {
    it("lastDividendTime 正好等于收益记录时间", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      
      await time.increase(DAY);
      const revenueTime = await time.latest();
      
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), revenueTime);

      await time.increase(DAY * 2);
      const withdrawTime = await time.latest();

      // lastDividendTime 等于 revenueTime
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        revenueTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 应该不包含该笔收益（因为在 lastDividendTime 时已经算过了）
      expect(result).to.equal(0);
    });

    it("withdrawTime 正好等于最后一笔收益时间", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      const revenueAmount = ethers.parseUnits("5000", 6);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());
      
      const withdrawTime = await time.latest(); // 就是收益记录时间

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 应该包含这笔收益
      const expected = (revenueAmount * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });

    it("非常短的时间范围", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      // 立即记录收益
      const revenueAmount = ethers.parseUnits("5000", 6);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());
      
      // 1秒后提取
      await time.increase(1);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (revenueAmount * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });
  });

  describe("精度测试", function () {
    it("应该正确处理小额分红", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      // 很小的收益
      const smallRevenue = ethers.parseUnits("0.01", 6); // 0.01 USDT
      await revenueManager.recordPeriodRevenue(smallRevenue, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (smallRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
      
      if (result > 0) {
        console.log(`  小额分红: ${ethers.formatUnits(result, 6)} USDT`);
      }
    });

    it("应该正确处理大额分红", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      // 很大的收益
      const largeRevenue = ethers.parseUnits("1000000", 6); // 100万 USDT
      await revenueManager.recordPeriodRevenue(largeRevenue, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (largeRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
      
      console.log(`  大额分红: ${ethers.formatUnits(result, 6)} USDT`);
    });

    it("应该正确处理精度截断", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      // 会导致精度截断的金额
      const revenueAmount = ethers.parseUnits("0.0001", 6); // 0.0001 USDT
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      // 使用非常小的份额
      const tinyShares = ethers.parseUnits("1", 18); // 0.0001%

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        tinyShares
      );

      // 可能会截断为 0
      const expected = (revenueAmount * tinyShares) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });
  });

  describe("边界条件测试", function () {
    it("份额为 0 时应该返回 0", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        0 // 份额为 0
      );

      expect(result).to.equal(0);
    });

    it("份额等于总供应量时应该获得全部收益", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      const revenueAmount = ethers.parseUnits("10000", 6);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        MAX_TOTAL_SUPPLY // 持有全部份额
      );

      // 应该获得全部收益
      expect(result).to.equal(revenueAmount);
    });

    it("时间范围内没有收益记录应该返回 0", async function () {
      // 售罄后等待并先记录一笔收益
      await time.increase(DAY * 2);
      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), await time.latest());
      
      await time.increase(DAY * 5);
      
      // 从这之后的时间范围内没有新收益
      const startTime = await time.latest();
      await time.increase(DAY * 3);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      expect(result).to.equal(0);
    });
  });

  describe("RevenueManager 截断时间功能集成", function () {
    it("应该正确处理按天截断的时间戳", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(HOUR * 6); // 前进6小时

      // 记录收益（时间戳会被截断到天）
      const revenueAmount = ethers.parseUnits("5000", 6);
      const recordTime = await time.latest();
      await revenueManager.recordPeriodRevenue(revenueAmount, recordTime);

      // 验证时间戳确实被截断了
      const truncatedTime = recordTime - (recordTime % DAY);
      const isRecorded = await revenueManager.isTimestampRecorded(truncatedTime);
      expect(isRecorded).to.be.true;

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (revenueAmount * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });

    it("同一天内多次记录收益应该累计", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      
      // startTime 设置在收益记录的前一天
      const startTime = await time.latest();
      
      // 前进到新的一天开始记录收益
      await time.increase(DAY + HOUR);

      // 同一天内记录多次
      const revenue1 = ethers.parseUnits("1000", 6);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(HOUR * 6);
      
      const revenue2 = ethers.parseUnits("2000", 6);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(HOUR * 6);
      
      const revenue3 = ethers.parseUnits("3000", 6);
      await revenueManager.recordPeriodRevenue(revenue3, await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 应该累计所有收益
      const totalRevenue = revenue1 + revenue2 + revenue3;
      const expected = (totalRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });
  });

  describe("Gas 消耗测试", function () {
    it("应该测量单笔收益的 gas 消耗", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      await revenueManager.recordPeriodRevenue(ethers.parseUnits("5000", 6), await time.latest());

      await time.increase(DAY);
      const withdrawTime = await time.latest();

      const gasEstimate = await assetTokenHelper.calculateDividendAmountPublic.estimateGas(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      console.log(`  单笔收益 Gas 消耗: ${gasEstimate.toString()}`);
      
      // Gas 应该在合理范围内（使用 findMaxMarkedIndex 会消耗较多 gas）
      expect(gasEstimate).to.be.lessThan(3000000n);
    });

    it("应该测量多笔收益的 gas 消耗", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      // 记录10笔收益
      for (let i = 0; i < 10; i++) {
        await revenueManager.recordPeriodRevenue(ethers.parseUnits("1000", 6), await time.latest());
        await time.increase(DAY);
      }

      const withdrawTime = await time.latest();

      const gasEstimate = await assetTokenHelper.calculateDividendAmountPublic.estimateGas(
        startTime,
        withdrawTime,
        HOLDER_SHARES
      );

      console.log(`  10笔收益 Gas 消耗: ${gasEstimate.toString()}`);
      
      // 多笔收益的 gas 消耗不应该线性增长
      expect(gasEstimate).to.be.lessThan(3000000n);
    });
  });
});

