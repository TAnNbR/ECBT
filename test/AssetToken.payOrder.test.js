const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AssetToken payOrder 函数测试 (集成测试)", function () {
  let assetToken;
  let collateralVault;
  let revenueManager;
  let liquidateManager;
  let orderBook;
  let paymentToken;
  let owner, seller, buyer, buyer2, provider, recipient;

  // 资产参数
  const ASSET_NAME = "Test Real Estate Token";
  const ASSET_SYMBOL = "TRE";
  const TOTAL_VALUE = ethers.parseUnits("1000000", 6);
  const FUNDRAISE_AMOUNT = ethers.parseUnits("500000", 6);
  const MAX_TOTAL_SUPPLY = ethers.parseUnits("1000000", 18);
  
  // 季度参数
  const QUARTERLY_EXPECTED_DIVIDEND = ethers.parseUnits("10000", 6);
  const QUARTER_CYCLE_DAYS = 7;

  // 时间常量
  const DAY = 86400;

  beforeEach(async function () {
    [owner, seller, buyer, buyer2, provider, recipient] = await ethers.getSigners();

    // 1. 部署 Mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await paymentToken.waitForDeployment();

    await paymentToken.mint(seller.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(buyer.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(buyer2.address, ethers.parseUnits("600000", 6));
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

    // 5. 部署 OrderBook
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const feeCollector = owner.address;
    const feeRate = 50; // 0.5%
    orderBook = await OrderBook.deploy(feeCollector, feeRate);
    await orderBook.waitForDeployment();

    // 6. 部署 AssetToken
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
    await assetToken.setOrderBook(await orderBook.getAddress());
    await orderBook.setAssetToken(await assetToken.getAddress());
  });

  describe("基本购买流程", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      await time.increase(DAY * 2 + 1);

      // 记录一个基础收益（避免 Invalid range）
      const baseRevenue = ethers.parseUnits("1000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), baseRevenue);
      await collateralVault.connect(provider).depositRevenue(baseRevenue);
      await revenueManager.recordPeriodRevenue(baseRevenue, await time.latest());

      await time.increase(DAY);

      // seller 创建卖单
      const sellAmount = ethers.parseUnits("200000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      // 再等待一天，确保 payOrder 时时间范围有效
      await time.increase(DAY);
    });

    it("应该成功购买卖单", async function () {

      const orderId = 1n;
      const purchaseAmount = ethers.parseUnits("100000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额：price 是 18 位精度，需要转换为 6 位精度的 USDT
      // paymentAmount = (purchaseAmount * price) / 1e18 / 1e12
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      // 买家授权支付代币
      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);

      // 记录买家和卖家余额
      const buyerTokenBefore = await assetToken.balanceOf(buyer.address);
      const sellerTokenBefore = await assetToken.balanceOf(seller.address);
      const buyerPaymentBefore = await paymentToken.balanceOf(buyer.address);
      const sellerPaymentBefore = await paymentToken.balanceOf(seller.address);

      // 购买
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);

      // 验证代币转移
      expect(await assetToken.balanceOf(buyer.address)).to.equal(buyerTokenBefore + purchaseAmount);
      expect(await assetToken.balanceOf(seller.address)).to.equal(sellerTokenBefore - purchaseAmount);

      // 验证支付
      expect(await paymentToken.balanceOf(buyer.address)).to.equal(buyerPaymentBefore - paymentAmount);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(sellerPaymentBefore + paymentAmount);

      // 验证订单更新
      const updatedOrder = await orderBook.getOrder(orderId);
      expect(updatedOrder.filledAmount).to.equal(purchaseAmount);
    });

    it("应该创建买家的 holderInfo", async function () {
      const orderId = 1n;
      const purchaseAmount = ethers.parseUnits("100000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);

      // 验证 holderInfo
      const holderInfo = await assetToken.holderInfo(buyer.address, 0);
      expect(holderInfo.shares).to.equal(purchaseAmount);
      expect(holderInfo.holdingStartTime).to.be.greaterThan(0);
      expect(holderInfo.lastDividendTime).to.equal(ethers.MaxUint256); // INVALID_TIMESTAMP
      expect(holderInfo.lastLiquidationClaimTime).to.equal(ethers.MaxUint256);
    });

    it("应该支持部分购买", async function () {
      const orderId = 1n;
      const sellAmount = ethers.parseUnits("200000", 18);
      const purchaseAmount = ethers.parseUnits("50000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);

      // 验证订单仍为 Active
      const updatedOrder = await orderBook.getOrder(orderId);
      expect(updatedOrder.status).to.equal(0); // Active
      expect(updatedOrder.filledAmount).to.equal(purchaseAmount);

      // 验证剩余可购买
      const remaining = updatedOrder.amount - updatedOrder.filledAmount;
      expect(remaining).to.equal(sellAmount - purchaseAmount);
    });

    it("应该支持完全购买", async function () {
      const orderId = 1n;
      const sellAmount = ethers.parseUnits("200000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (sellAmount * order.price) / ethers.parseUnits("1", 30);

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
      await assetToken.connect(buyer).payOrder(orderId, sellAmount);

      // 验证订单状态更新为 Filled
      const updatedOrder = await orderBook.getOrder(orderId);
      expect(updatedOrder.status).to.equal(1); // Filled
      expect(updatedOrder.filledAmount).to.equal(sellAmount);
    });

    it("应该支持多次购买", async function () {
      const orderId = 1n;
      const purchase1 = ethers.parseUnits("50000", 18);
      const purchase2 = ethers.parseUnits("80000", 18);
      const order = await orderBook.getOrder(orderId);

      // 第一次购买
      const payment1 = (purchase1 * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer).payOrder(orderId, purchase1);

      // 第二次购买
      const payment2 = (purchase2 * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer2).payOrder(orderId, purchase2);

      // 验证订单
      const updatedOrder = await orderBook.getOrder(orderId);
      expect(updatedOrder.filledAmount).to.equal(purchase1 + purchase2);

      // 验证 holderInfo
      expect(await assetToken.balanceOf(buyer.address)).to.equal(purchase1);
      expect(await assetToken.balanceOf(buyer2.address)).to.equal(purchase2);
    });
  });

  describe("分红转移", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      await time.increase(DAY * 2 + 1);

      // 记录基础收益（避免 Invalid range）
      const baseRevenue = ethers.parseUnits("1000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), baseRevenue);
      await collateralVault.connect(provider).depositRevenue(baseRevenue);
      await revenueManager.recordPeriodRevenue(baseRevenue, await time.latest());

      await time.increase(DAY);
    });

    it("应该在购买时转移期间分红给卖家", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("200000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      const orderId = 1n;

      // 记录收益（订单创建后）
      await time.increase(DAY * 2);
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 2);

      // 买家购买
      const purchaseAmount = ethers.parseUnits("100000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);

      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);
      const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);

      // 验证卖家收到：支付金额 + 分红
      const received = sellerBalanceAfter - sellerBalanceBefore;
      
      // 分红 = 100,000 份额占 1,000,000 总供应量的 10%
      const expectedDividend = revenue / 10n;
      expect(received).to.be.greaterThan(paymentAmount); // 应该多于支付金额
      expect(received).to.equal(paymentAmount + expectedDividend);
    });

    it("订单创建后一段时间无分红时，不应转移分红", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("200000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      await time.increase(DAY); // 确保时间范围有效

      const orderId = 1n;
      const purchaseAmount = ethers.parseUnits("100000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);

      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);
      const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);

      // 验证卖家只收到支付金额，没有分红
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(paymentAmount);
    });

    it("二次交易，期间无分红", async function () {
        // 创建卖单
        const sellAmount = ethers.parseUnits("200000", 18);
        const sellPrice = ethers.parseUnits("0.6", 18);
        await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
  
        await time.increase(DAY); // 确保时间范围有效
  
        const orderId = 1n;
        const purchaseAmount = ethers.parseUnits("100000", 18);
        const order = await orderBook.getOrder(orderId);
        // 计算支付金额（转换为 6 位精度）
        const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);
  
        await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
        await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);


        await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
        await time.increase(DAY); // 确保时间范围有效

        const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
        await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
        await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);
        const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);

  
        // 验证卖家只收到支付金额，没有分红
        expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(paymentAmount);
      });

      it("二次交易，期间有分红", async function () {
        // 创建卖单
        const sellAmount = ethers.parseUnits("200000", 18);
        const sellPrice = ethers.parseUnits("0.6", 18);
        await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
  
        await time.increase(DAY); // 确保时间范围有效
  
        const orderId = 1n;
        const purchaseAmount = ethers.parseUnits("100000", 18);
        const order = await orderBook.getOrder(orderId);
        // 计算支付金额（转换为 6 位精度）
        const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);
  
        await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
        await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);


        await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
        await time.increase(DAY); // 确保时间范围有效

        const revenue = ethers.parseUnits("5000", 6);
        await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
        await collateralVault.connect(provider).depositRevenue(revenue);
        await revenueManager.recordPeriodRevenue(revenue, await time.latest());

        await time.increase(DAY);
        const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
        await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
        await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);
        const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);

  
        // 分红 = 100,000 份额占 1,000,000 总供应量的 10%
        const expectedDividend = revenue / 10n;
        expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(paymentAmount + expectedDividend);
      });


  });

  describe("清算金转移", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      await time.increase(DAY * 2 + 1);

      // 记录基础收益
      const baseRevenue = ethers.parseUnits("1000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), baseRevenue);
      await collateralVault.connect(provider).depositRevenue(baseRevenue);
      await revenueManager.recordPeriodRevenue(baseRevenue, await time.latest());

      await time.increase(DAY);
    });

    it("应该在购买时转移期间清算金给卖家", async function () {
      // 存入抵押金
      const collateralAmount = ethers.parseUnits("100000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 创建卖单
      const sellAmount = ethers.parseUnits("200000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      const orderId = 1n;

      // 触发清算（订单创建后）
      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();

      await time.increase(DAY);

      // 买家购买
      const purchaseAmount = ethers.parseUnits("100000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);

      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);
      const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);

      // 验证卖家收到：支付金额 + 清算金
      const received = sellerBalanceAfter - sellerBalanceBefore;
      
      // 清算金 = 100,000 份额 / 1,000,000 总供应量 * 抵押金 * 20%
      const expectedLiquidation = collateralAmount * purchaseAmount / MAX_TOTAL_SUPPLY * 2000n / 10000n;
      expect(received).to.be.greaterThan(paymentAmount);
      expect(received).to.equal(paymentAmount + expectedLiquidation);
    });
  });

  describe("参数验证", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      await time.increase(DAY * 2 + 1);

      // 记录基础收益
      const baseRevenue = ethers.parseUnits("1000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), baseRevenue);
      await collateralVault.connect(provider).depositRevenue(baseRevenue);
      await revenueManager.recordPeriodRevenue(baseRevenue, await time.latest());

      await time.increase(DAY);

      // seller 创建卖单
      const sellAmount = ethers.parseUnits("200000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      // 再等待一天
      await time.increase(DAY);
    });

    it("应该拒绝零购买数量", async function () {
      const orderId = 1n;
      await expect(
        assetToken.connect(buyer).payOrder(orderId, 0)
      ).to.be.revertedWith("Purchase amount must be greater than 0");
    });

    it("应该拒绝超过剩余数量的购买", async function () {
      const orderId = 1n;
      const order = await orderBook.getOrder(orderId);
      const remaining = order.amount - order.filledAmount;
      const tooMuch = remaining + ethers.parseUnits("1", 18);

      const paymentAmount = (tooMuch * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);

      await expect(
        assetToken.connect(buyer).payOrder(orderId, tooMuch)
      ).to.be.revertedWith("Purchase amount exceeds remaining");
    });

    it("应该拒绝购买非活跃订单", async function () {
      const orderId = 1n;
      const order = await orderBook.getOrder(orderId);
      const sellAmount = order.amount;

      // 完全购买订单
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (sellAmount * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
      await assetToken.connect(buyer).payOrder(orderId, sellAmount);

      // 尝试再次购买已完成的订单
      await expect(
        assetToken.connect(buyer2).payOrder(orderId, ethers.parseUnits("1", 18))
      ).to.be.revertedWith("Order not active");
    });

    it("应该拒绝未授权足够支付代币的购买", async function () {
      const orderId = 1n;
      const purchaseAmount = ethers.parseUnits("100000", 18);

      // 不授权或授权不足
      await expect(
        assetToken.connect(buyer).payOrder(orderId, purchaseAmount)
      ).to.be.reverted;
    });

    it("应该拒绝在未设置 OrderBook 时购买", async function () {
      // 部署新的 AssetToken，但不设置 OrderBook
      const AssetToken = await ethers.getContractFactory("AssetToken");
      const newAssetToken = await AssetToken.deploy();
      await newAssetToken.waitForDeployment();

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

      await newAssetToken.initialize(
        metadata,
        await paymentToken.getAddress(),
        await collateralVault.getAddress(),
        await revenueManager.getAddress()
      );

      await expect(
        newAssetToken.connect(buyer).payOrder(1n, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("OrderBook not set");
    });
  });

  describe("边界条件测试", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      await time.increase(DAY * 2 + 1);

      // 记录基础收益
      const baseRevenue = ethers.parseUnits("1000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), baseRevenue);
      await collateralVault.connect(provider).depositRevenue(baseRevenue);
      await revenueManager.recordPeriodRevenue(baseRevenue, await time.latest());

      await time.increase(DAY);
    });

    it("应该支持购买最小数量", async function () {
      const sellAmount = ethers.parseUnits("1000", 18);
      const sellPrice = ethers.parseUnits("0.5", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      await time.increase(DAY); // 确保时间范围有效

      const orderId = 1n;
      const purchaseAmount = ethers.parseUnits("1", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);

      expect(await assetToken.balanceOf(buyer.address)).to.equal(purchaseAmount);
    });

    it("应该支持高价格购买", async function () {
      const sellAmount = ethers.parseUnits("10000", 18);
      const sellPrice = ethers.parseUnits("100", 18); // 高价格
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      await time.increase(DAY); // 确保时间范围有效

      const orderId = 1n;
      const purchaseAmount = ethers.parseUnits("1000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      // 确保买家有足够的支付代币
      await paymentToken.mint(buyer.address, paymentAmount);
      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);
      
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);

      expect(await assetToken.balanceOf(buyer.address)).to.equal(purchaseAmount);
    });

    it("应该正确处理精确剩余数量的购买", async function () {
      const sellAmount = ethers.parseUnits("200000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      await time.increase(DAY); // 确保时间范围有效

      const orderId = 1n;
      const purchase1 = ethers.parseUnits("123456", 18);
      const order = await orderBook.getOrder(orderId);

      // 第一次购买
      const payment1 = (purchase1 * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer).payOrder(orderId, purchase1);

      // 购买剩余全部
      const updatedOrder = await orderBook.getOrder(orderId);
      const remaining = updatedOrder.amount - updatedOrder.filledAmount;
      const payment2 = (remaining * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer2).payOrder(orderId, remaining);

      // 验证订单完全成交
      const finalOrder = await orderBook.getOrder(orderId);
      expect(finalOrder.status).to.equal(1); // Filled
      expect(finalOrder.filledAmount).to.equal(sellAmount);
    });
  });

  describe("复杂场景测试", function () {
    it("应该正确处理：卖单 -> 分红 -> 清算 -> 购买的完整流程", async function () {
      // 1. seller 购买全部代币
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      await time.increase(DAY * 2 + 1);

      // 2. 存入抵押金
      const collateralAmount = ethers.parseUnits("100000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 3. 记录基础收益
      const baseRevenue = ethers.parseUnits("1000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), baseRevenue);
      await collateralVault.connect(provider).depositRevenue(baseRevenue);
      await revenueManager.recordPeriodRevenue(baseRevenue, await time.latest());

      await time.increase(DAY);

      // 4. 创建卖单
      const sellAmount = ethers.parseUnits("300000", 18);
      const sellPrice = ethers.parseUnits("0.55", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      const orderId = 1n;

      // 5. 记录收益
      await time.increase(DAY);
      const revenue = ethers.parseUnits("8000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 2);

      // 6. 触发清算
      await time.increase(QUARTER_CYCLE_DAYS * DAY - DAY * 4);
      await liquidateManager.checkQuarterlyRevenue();

      await time.increase(DAY);

      // 7. 买家购买
      const purchaseAmount = ethers.parseUnits("150000", 18);
      const order = await orderBook.getOrder(orderId);
      // 计算支付金额（转换为 6 位精度）
      const paymentAmount = (purchaseAmount * order.price) / ethers.parseUnits("1", 30);

      // 确保买家有足够余额
      const buyerBalance = await paymentToken.balanceOf(buyer.address);
      if (buyerBalance < paymentAmount) {
        await paymentToken.mint(buyer.address, paymentAmount - buyerBalance + ethers.parseUnits("10000", 6));
      }

      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), paymentAmount);

      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(buyer).payOrder(orderId, purchaseAmount);
      const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);

      // 7. 验证卖家收到：支付 + 分红 + 清算金
      const received = sellerBalanceAfter - sellerBalanceBefore;
      expect(received).to.be.greaterThan(paymentAmount);

      // 8. 验证买家持有
      expect(await assetToken.balanceOf(buyer.address)).to.equal(purchaseAmount);
      const holderInfo = await assetToken.holderInfo(buyer.address, 0);
      expect(holderInfo.shares).to.equal(purchaseAmount);
    });

    it("应该支持多买家分批购买同一订单", async function () {
      // seller 购买全部代币
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      await time.increase(DAY * 2 + 1);

      // 记录基础收益
      const baseRevenue = ethers.parseUnits("1000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), baseRevenue);
      await collateralVault.connect(provider).depositRevenue(baseRevenue);
      await revenueManager.recordPeriodRevenue(baseRevenue, await time.latest());

      await time.increase(DAY);

      // 创建大卖单
      const sellAmount = ethers.parseUnits("500000", 18);
      const sellPrice = ethers.parseUnits("0.52", 18);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      await time.increase(DAY); // 确保时间范围有效

      const orderId = 1n;
      const order = await orderBook.getOrder(orderId);

      // buyer 购买 30%
      const purchase1 = sellAmount * 30n / 100n;
      const payment1 = (purchase1 * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer).payOrder(orderId, purchase1);

      // buyer2 购买 50%
      const purchase2 = sellAmount * 50n / 100n;
      const payment2 = (purchase2 * order.price) / ethers.parseUnits("1", 30);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer2).payOrder(orderId, purchase2);

      // 验证持有
      expect(await assetToken.balanceOf(buyer.address)).to.equal(purchase1);
      expect(await assetToken.balanceOf(buyer2.address)).to.equal(purchase2);

      // 验证订单状态
      const updatedOrder = await orderBook.getOrder(orderId);
      expect(updatedOrder.filledAmount).to.equal(purchase1 + purchase2);
      expect(updatedOrder.status).to.equal(0); // 仍为 Active（还有20%未售）
    });
  });
});

