const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AssetToken withdrawDividend 函数测试 (集成测试)", function () {
  let assetToken;
  let collateralVault;
  let revenueManager;
  let liquidateManager;
  let paymentToken;
  let owner, buyer1, buyer2, buyer3, provider, recipient;

  // 资产参数
  const ASSET_NAME = "Test Real Estate Token";
  const ASSET_SYMBOL = "TRE";
  const TOTAL_VALUE = ethers.parseUnits("1000000", 6);
  const FUNDRAISE_AMOUNT = ethers.parseUnits("500000", 6);
  const MAX_TOTAL_SUPPLY = ethers.parseUnits("1000000", 18);
  
  // 季度参数
  const QUARTERLY_EXPECTED_DIVIDEND = ethers.parseUnits("10000", 6);
  const QUARTER_CYCLE_DAYS = 7; // 7天一个季度（便于测试）

  // 时间常量
  const DAY = 86400;
  const HOUR = 3600;

  beforeEach(async function () {
    [owner, buyer1, buyer2, buyer3, provider, recipient] = await ethers.getSigners();

    // 1. 部署 Mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await paymentToken.waitForDeployment();

    await paymentToken.mint(buyer1.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(buyer2.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(buyer3.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(provider.address, ethers.parseUnits("1000000", 6));

    // 2. 部署 CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    collateralVault = await CollateralVault.deploy(await paymentToken.getAddress());
    await collateralVault.waitForDeployment();

    // 3. 部署 RevenueManager
    const RevenueManager = await ethers.getContractFactory("RevenueManager");
    revenueManager = await RevenueManager.deploy();
    await revenueManager.waitForDeployment();
    await revenueManager.setUnitSeconds(2); // DAY

    // 4. 部署 LiquidateManager
    const LiquidateManager = await ethers.getContractFactory("LiquidateManager");
    liquidateManager = await LiquidateManager.deploy();
    await liquidateManager.waitForDeployment();

    await liquidateManager.setQuarterlyExpectedDividend(QUARTERLY_EXPECTED_DIVIDEND);
    await liquidateManager.setQuarterCycleDays(QUARTER_CYCLE_DAYS);
    await liquidateManager.setRevenueManager(await revenueManager.getAddress());
    await liquidateManager.setCollateralVault(await collateralVault.getAddress());

    // 5. 部署 AssetToken
    const AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy();
    await assetToken.waitForDeployment();

    const metadata = {
      name: ASSET_NAME,
      symbol: ASSET_SYMBOL,
      totalValue: TOTAL_VALUE,
      fundraiseAmount: FUNDRAISE_AMOUNT,
      maxTotalSupply: MAX_TOTAL_SUPPLY,
      specialPurposeVehicle: owner.address,
      provider: provider.address,
      createdAt: await ethers.provider.getBlock('latest').then(b => b.timestamp)
    };

    await assetToken.initialize(
      metadata,
      await paymentToken.getAddress(),
      await collateralVault.getAddress(),
      await revenueManager.getAddress()
    );

    await assetToken.setLiquidateManager(await liquidateManager.getAddress());
  });

  describe("分红提取", function () {
    beforeEach(async function () {
      // 购买全部代币触发售罄
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后（soldOutTimestamp + 1 day + 1 second）
      // 强制更新区块时间戳
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }
    });

    it("售罄后单笔分红", async function () {
      // 记录收益
      await time.increase(DAY);
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 2);

      // 提取分红
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;
      expect(received).to.equal(revenue); // 100% 持有获得全部收益
    });

    it("售罄后多笔分红", async function () {
      // 记录多笔收益
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);
      const revenue2 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      // 提取分红
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;
      expect(received).to.equal(revenue1 + revenue2);
    });

    it("售罄后无分红", async function () {
      // 等待一段时间但不记录任何收益
      await time.increase(DAY * 3);

      // 提取分红
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;
      expect(received).to.equal(0); // 没有收益记录，领取到0
    });

    it("已领取过一次分红，再次领取时期间内没有新分红", async function () {
      // 第一次：记录收益并提取
      await time.increase(DAY);
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 2);

      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;
      expect(received1).to.equal(revenue); // 第一次领取成功

      // 第二次：等待一段时间但没有新的收益记录
      await time.increase(DAY * 3);

      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;
      expect(received2).to.equal(0); // 没有新收益，领取到0
    });

    it("已领取过多次累计的分红，再次领取时期间内没有新分红", async function () {
      // 第一次：记录多笔收益并提取
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);
      const revenue2 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;
      expect(received1).to.equal(revenue1 + revenue2); // 第一次领取多笔累计收益

      // 第二次：等待一段时间但没有新的收益记录
      await time.increase(DAY * 3);

      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;
      expect(received2).to.equal(0); // 没有新收益，领取到0
    });

    it("已领取过一次分红，再次领取时期间内有一次新分红", async function () {
      // 第一次：记录收益并提取
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);

      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;
      expect(received1).to.equal(revenue1); // 第一次领取成功

      // 第二次：记录一次新收益后再提取
      await time.increase(DAY);
      const revenue2 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;
      expect(received2).to.equal(revenue2); // 领取到新的单笔收益
    });

    it("已领取过一次分红，再次领取时期间内有多次新分红", async function () {
      // 第一次：记录收益并提取
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);

      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;
      expect(received1).to.equal(revenue1); // 第一次领取成功

      // 第二次：记录多次新收益后再提取
      await time.increase(DAY);
      const revenue2 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);
      const revenue3 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue3);
      await collateralVault.connect(provider).depositRevenue(revenue3);
      await revenueManager.recordPeriodRevenue(revenue3, await time.latest());

      await time.increase(DAY * 2);

      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;
      expect(received2).to.equal(revenue2 + revenue3); // 领取到新的多笔累计收益
    });

    it("已领取过多次累计的分红，再次领取时期间内有一次新分红", async function () {
      // 第一次：记录多笔收益并提取
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);
      const revenue2 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;
      expect(received1).to.equal(revenue1 + revenue2); // 第一次领取多笔累计收益

      // 第二次：记录一次新收益后再提取
      await time.increase(DAY);
      const revenue3 = ethers.parseUnits("2000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue3);
      await collateralVault.connect(provider).depositRevenue(revenue3);
      await revenueManager.recordPeriodRevenue(revenue3, await time.latest());

      await time.increase(DAY * 2);

      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;
      expect(received2).to.equal(revenue3); // 领取到新的单笔收益
    });

    it("已领取过多次累计的分红，再次领取时期间内有多次新分红", async function () {
      // 第一次：记录多笔收益并提取
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);
      const revenue2 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;
      expect(received1).to.equal(revenue1 + revenue2); // 第一次领取多笔累计收益

      // 第二次：记录多次新收益后再提取
      await time.increase(DAY);
      const revenue3 = ethers.parseUnits("2000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue3);
      await collateralVault.connect(provider).depositRevenue(revenue3);
      await revenueManager.recordPeriodRevenue(revenue3, await time.latest());

      await time.increase(DAY * 2);
      const revenue4 = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue4);
      await collateralVault.connect(provider).depositRevenue(revenue4);
      await revenueManager.recordPeriodRevenue(revenue4, await time.latest());

      await time.increase(DAY * 2);

      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;
      expect(received2).to.equal(revenue3 + revenue4); // 领取到新的多笔累计收益
    });
  });

  describe("清算金提取", function () {
    beforeEach(async function () {
      // 购买全部代币触发售罄
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      // 存入抵押金
      const collateralAmount = ethers.parseUnits("100000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }
    });

    it("单次清算提取", async function () {
      // 不达标收益触发清算
      await time.increase(DAY);
      const lowRevenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), lowRevenue);
      await collateralVault.connect(provider).depositRevenue(lowRevenue);
      await revenueManager.recordPeriodRevenue(lowRevenue, await time.latest());

      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();

      expect(await liquidateManager.liquidationCount()).to.equal(1);

      // 提取清算金
      await time.increase(DAY);
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;
      
      // 预期：分红5000 + 清算金20000 = 25000 USDT
      const expectedDividend = lowRevenue;
      const expectedLiquidation = ethers.parseUnits("100000", 6) * 2000n / 10000n;
      expect(received).to.equal(expectedDividend + expectedLiquidation);
    });

    it("多次清算累计提取", async function () {
      // 第一次清算
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1);

      // 第二次清算
      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      const revenue2 = ethers.parseUnits("6000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(2);

      // 提取
      await time.increase(DAY);
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;
      
      // 预期：分红11000 + 清算金40000 = 51000 USDT
      const expectedDividend = revenue1 + revenue2;
      const expectedLiquidation = ethers.parseUnits("100000", 6) * 2000n / 10000n * 2n;
      expect(received).to.equal(expectedDividend + expectedLiquidation);
    });
  });

  describe("分红 + 清算复合场景", function () {
    beforeEach(async function () {
      // 购买全部代币触发售罄
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      // 存入抵押金
      const collateralAmount = ethers.parseUnits("100000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }
    });

    it("第一次提取分红，第二次提取分红+清算金", async function () {
      // 记录第一笔收益
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("8000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);

      // 第一次提取（只有分红，还没清算）
      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;

      expect(received1).to.equal(revenue1); // 只有分红

      // 触发清算
      await time.increase(QUARTER_CYCLE_DAYS * DAY - DAY * 3);
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1);

      // 记录第二笔收益（清算后）
      await time.increase(DAY);
      const revenue2 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      // 第二次提取（新分红 + 清算金）
      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;

      // 预期：分红3000 + 清算金20000 = 23000 USDT
      const expectedDividend = revenue2;
      const expectedLiquidation = ethers.parseUnits("100000", 6) * 2000n / 10000n;
      expect(received2).to.equal(expectedDividend + expectedLiquidation);
    });

    it("清算在分红之前，提取时获得两者", async function () {
      // 先触发清算（零收益）
      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1);

      // 记录收益（清算后）
      await time.increase(DAY);
      const revenue = ethers.parseUnits("6000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 2);

      // 提取
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;

      // 预期：分红6000 + 清算金20000 = 26000 USDT
      const expectedDividend = revenue;
      const expectedLiquidation = ethers.parseUnits("100000", 6) * 2000n / 10000n;
      expect(received).to.equal(expectedDividend + expectedLiquidation);
    });
  });

  describe("多次购买的复合场景", function () {
    it("两次购买，不同份额有不同的分红和清算起始时间", async function () {
      // 第一次购买一半
      const amount1 = MAX_TOTAL_SUPPLY / 2n;
      const payment1 = FUNDRAISE_AMOUNT / 2n;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);

      await time.increase(DAY * 2);

      // 第二次购买另一半（触发售罄）
      const amount2 = MAX_TOTAL_SUPPLY - amount1;
      const payment2 = FUNDRAISE_AMOUNT - payment1;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer1).purchase(amount2);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }

      // 存入抵押金（售罄后）
      const collateralAmount = ethers.parseUnits("80000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 记录第一笔收益（售罄后）
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      // 触发清算
      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1);

      // 记录第二笔收益（清算后）
      await time.increase(DAY);
      const revenue2 = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      // 提取
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;

      // 验证：分红 + 清算金
      const expectedDividend = revenue1 + revenue2;
      const expectedLiquidation = collateralAmount * 2000n / 10000n;
      expect(received).to.equal(expectedDividend + expectedLiquidation);

      // 验证份额被合并
      const holderInfo = await assetToken.holderInfo(buyer1.address, 0);
      expect(holderInfo.shares).to.equal(MAX_TOTAL_SUPPLY);
    });
  });

  describe("时间边界测试", function () {
    beforeEach(async function () {
      // 购买全部代币触发售罄
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      // 存入抵押金
      const collateralAmount = ethers.parseUnits("50000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }
    });

    it("lastDividendTime 和 lastClaimTime 独立更新", async function () {
      // 记录收益
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(DAY * 2);

      // 第一次提取（只有分红）
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);

      // 验证时间戳更新
      let holderInfo = await assetToken.holderInfo(buyer1.address, 0);
      const firstWithdrawTime = holderInfo.lastDividendTime;
      expect(firstWithdrawTime).to.be.greaterThan(0);
      expect(holderInfo.lastLiquidationClaimTime).to.equal(firstWithdrawTime);

      // 触发清算
      await time.increase(QUARTER_CYCLE_DAYS * DAY - DAY * 3);
      await liquidateManager.checkQuarterlyRevenue();

      // 只记录新收益，不提取
      await time.increase(DAY);
      const revenue2 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      await time.increase(DAY * 2);

      // 第二次提取
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);

      // 验证时间戳再次更新
      holderInfo = await assetToken.holderInfo(buyer1.address, 0);
      expect(holderInfo.lastDividendTime).to.be.greaterThan(firstWithdrawTime);
      expect(holderInfo.lastLiquidationClaimTime).to.be.greaterThan(firstWithdrawTime);
    });

    it("连续两次提取，第二次无新收益和清算", async function () {
      // 记录收益并触发清算
      await time.increase(DAY);
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();

      await time.increase(DAY);

      // 第一次提取
      const recipient1Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient1After = await paymentToken.balanceOf(recipient.address);
      const received1 = recipient1After - recipient1Before;

      expect(received1).to.be.greaterThan(0);

      // 第二次提取（无新收益和清算）
      await time.increase(DAY * 2);
      const recipient2Before = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipient2After = await paymentToken.balanceOf(recipient.address);
      const received2 = recipient2After - recipient2Before;

      expect(received2).to.equal(0);
    });
  });

  describe("holdTime 在清算中间的场景", function () {
    it("中间购买的份额只获得后续的清算金", async function () {
      // 第一次购买一半
      const amount1 = MAX_TOTAL_SUPPLY / 2n;
      const payment1 = FUNDRAISE_AMOUNT / 2n;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);

      await time.increase(DAY * 2);

      // 第二次购买另一半（触发售罄）
      const amount2 = MAX_TOTAL_SUPPLY - amount1;
      const payment2 = FUNDRAISE_AMOUNT - payment1;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer1).purchase(amount2);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }

      // 存入抵押金（售罄后）
      const collateralAmount = ethers.parseUnits("60000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 记录收益
      await time.increase(DAY);
      const revenue1 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      // 第一次清算（售罄后，第二次购买之后）
      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(1);

      // 记录新收益
      await time.increase(DAY);
      const revenue2 = ethers.parseUnits("4000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      // 第二次清算
      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      const revenue3 = ethers.parseUnits("2000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue3);
      await collateralVault.connect(provider).depositRevenue(revenue3);
      await revenueManager.recordPeriodRevenue(revenue3, await time.latest());
      
      await liquidateManager.checkQuarterlyRevenue();
      expect(await liquidateManager.liquidationCount()).to.equal(2);

      await time.increase(DAY);

      // 提取
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;

      // 验证：应该获得分红 + 清算金（所有份额都在售罄后，所以都获得清算金）
      const expectedDividend = revenue1 + revenue2 + revenue3;
      const expectedLiquidation = collateralAmount * 2000n / 10000n * 2n; // 2次清算
      expect(received).to.equal(expectedDividend + expectedLiquidation);
    });
  });

  describe("时间截断对复合场景的影响", function () {
    it("同一天内多次收益 + 清算", async function () {
      // 购买全部代币
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 2 + 1);

      // 存入抵押金
      const collateralAmount = ethers.parseUnits("40000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 在同一天内记录多笔收益
      await time.increase(HOUR * 6);
      const revenue1 = ethers.parseUnits("2000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue1);
      await collateralVault.connect(provider).depositRevenue(revenue1);
      await revenueManager.recordPeriodRevenue(revenue1, await time.latest());

      await time.increase(HOUR * 6);
      const revenue2 = ethers.parseUnits("3000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue2);
      await collateralVault.connect(provider).depositRevenue(revenue2);
      await revenueManager.recordPeriodRevenue(revenue2, await time.latest());

      // 触发清算
      await time.increase(DAY * 2);
      await liquidateManager.checkQuarterlyRevenue();

      await time.increase(DAY);

      // 提取
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;

      // 预期：同一天的两笔收益应该累计
      const expectedDividend = revenue1 + revenue2;
      const expectedLiquidation = collateralAmount * 2000n / 10000n;
      expect(received).to.equal(expectedDividend + expectedLiquidation);
    });
  });

  describe("参数验证", function () {
    it("应该拒绝无效的接收者地址", async function () {
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 2 + 1);

      await expect(
        assetToken.connect(buyer1).withdrawDividend(ethers.ZeroAddress, buyer1.address)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("应该拒绝在售罄时间之前提取", async function () {
      const amount = ethers.parseUnits("10000", 18);
      const payment = (amount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(amount);

      await expect(
        assetToken.connect(buyer1).withdrawDividend(recipient.address, buyer1.address)
      ).to.be.revertedWith("Token not sold out yet");
    });
  });
});
