const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AssetToken calculateDividendAmount 函数测试 (集成 RevenueManager)", function () {
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

  });

  describe("开始持有时间在售罄时间之前", function () {
    it("应该在没有收益记录时返回 0", async function () {
      // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();
      
      const lastDividendTime = Number(soldOutTime - BigInt(DAY));
      
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

    it("单笔收益计算", async function () {
      // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();
      
      const lastDividendTime = Number(soldOutTime - BigInt(DAY));

      // 确保时间前进到 soldOutTime + DAY 之后（需要严格大于）
      await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);

      const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);

      const withdrawTime = await time.latest();
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (dailyRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });

    it("多笔收益计算", async function () {
      // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();
      
      const lastDividendTime = Number(soldOutTime - BigInt(DAY));

      // 确保时间前进到 soldOutTime + DAY 之后（需要严格大于）
      await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);

      const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
      for (let i = 0; i < 7; i++) {
        await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
        await time.increase(DAY);
      }

      const withdrawTime = await time.latest();
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (dailyRevenue * BigInt(7) * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
      expect(result).to.equal(expected);
    });

    describe("时间边界测试", function () {
      it("收益时间等于领取分红时间", async function () {
        // 获取售罄时间戳
        const soldOutTime = await assetTokenHelper.soldOutTimestamp();
        
        const lastDividendTime = Number(soldOutTime - BigInt(DAY));
  
        // 确保时间前进到 soldOutTime + DAY 之后（需要严格大于）
        await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);
  
        const revenueTime = await time.latest();

        const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
        await revenueManager.recordPeriodRevenue(dailyRevenue, revenueTime);
  
        const withdrawTime = revenueTime;
        
        const result = await assetTokenHelper.calculateDividendAmountPublic(
          lastDividendTime,
          withdrawTime,
          HOLDER_SHARES
        );
  
        const expected = (dailyRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;
        expect(result).to.equal(expected);
      });
    });

  });

  describe("开始持有时间在第一次收益时间之后", function () {
    it("应该在没有收益记录时返回 0", async function () {
      // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();

      // 确保时间前进到 soldOutTime + DAY 之后（需要严格大于）
      await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);

      const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);

      const lastDividendTime = await time.latest();

      await time.increase(DAY);

      const withdrawTime = await time.latest();
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      expect(result).to.equal(0);
    });

    it("单笔收益计算", async function () {
      // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();

      // 确保时间前进到 soldOutTime + DAY 之后（需要严格大于）
      await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);

      const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);

      const lastDividendTime = await time.latest();
      await time.increase(DAY);

      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);

      const withdrawTime = await time.latest();
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (dailyRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;

      expect(result).to.equal(expected);
    });

    it("多笔收益计算", async function () {
      // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();

      // 确保时间前进到 soldOutTime + DAY 之后（需要严格大于）
      await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);

      const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);
      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);

      const lastDividendTime = await time.latest();
      await time.increase(DAY);

      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);
      await revenueManager.recordPeriodRevenue(dailyRevenue, await time.latest());
      await time.increase(DAY);

      const withdrawTime = await time.latest();
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (dailyRevenue * BigInt(2) * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;

      expect(result).to.equal(expected);
    });

    describe("时间边界测试", function () {
      it("收益时间等于开始持有时间，收益时间等于领取分红时间", async function () {
        // 获取售罄时间戳
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();

      // 确保时间前进到 soldOutTime + DAY 之后（需要严格大于）
      await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);

      const minRevenueTime = await time.latest();
      const dailyRevenue = ethers.parseUnits("1000", 6); // 每天 1000 USDT
      await revenueManager.recordPeriodRevenue(dailyRevenue, minRevenueTime);
      const lastDividendTime = minRevenueTime;
      await time.increase(DAY);

      const maxRevenueTime = await time.latest();
      await revenueManager.recordPeriodRevenue(dailyRevenue, maxRevenueTime);
      const withdrawTime = maxRevenueTime;
      
      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      const expected = (dailyRevenue * HOLDER_SHARES) / MAX_TOTAL_SUPPLY;

      expect(result).to.equal(expected);
      });
    });

  });

  describe("精度测试", function () {
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
      }
    });

    it("应该正确处理小额分红", async function () {
      // 售罄后等待
      await time.increase(DAY * 2);
      const startTime = await time.latest();
      
      await time.increase(DAY);

      // 很小的收益
      const smallRevenue = ethers.parseUnits("0.000001", 6); // 0.000001 USDT
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
    it("当 revenueManager 未设置时应该返回 0", async function () {
      // 这个测试验证 _calculateDividendAmount 函数中的 revenueManager 检查
      // 由于 purchase 需要 revenueManager，我们先用正常的 helper 购买，然后将 revenueManager 设为 0
      
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();
      
      // 确保时间推进到 soldOutTime + 1 day 之后
      await time.increaseTo(Number(soldOutTime + BigInt(DAY)) + 1);
      
      const lastDividendTime = await time.latest();
      await time.increase(DAY);
      const withdrawTime = await time.latest();

      // 通过测试合约设置 revenueManager 为 0（模拟未设置的情况）
      await assetTokenHelper.setRevenueManager(ethers.ZeroAddress);

      const result = await assetTokenHelper.calculateDividendAmountPublic(
        lastDividendTime,
        withdrawTime,
        HOLDER_SHARES
      );

      // 恢复 revenueManager
      await assetTokenHelper.setRevenueManager(await revenueManager.getAddress());

      expect(result).to.equal(0);
    });

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
    
  });

  describe("RevenueManager 截断时间功能集成", function () {
    it("第一次收益时间应该在售罄时间一天之后", async function () {
      const soldOutTime = await assetTokenHelper.soldOutTimestamp();
      
      // startTime 使用 soldOutTime 减去 1 天
      const startTime = Number(soldOutTime - BigInt(DAY));

      // 记录收益（时间戳会被截断到天）
      const revenueAmount = ethers.parseUnits("5000", 6);

      // 假设 soldOutTime + 6 小时不超过第二天 0 点
      await revenueManager.recordPeriodRevenue(revenueAmount, Number(soldOutTime) + 6 * HOUR);
      await time.increase(DAY);

      const withdrawTime = await time.latest();

      // 由于 onlySoldOut 修饰符要求 block.timestamp > soldOutTimestamp + 1 days
      // 当前时间不满足要求，应该 revert
      await expect(
        assetTokenHelper.calculateDividendAmountPublic(
          startTime,
          withdrawTime,
          HOLDER_SHARES
        )
      ).to.be.revertedWith("Token not sold out yet");
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

      
      // 多笔收益的 gas 消耗不应该线性增长
      expect(gasEstimate).to.be.lessThan(3000000n);
    });
  });
});

