const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AssetToken 联动集成测试 (withdrawDividend + sellShares + cancelOrder + payOrder)", function () {
  let assetToken;
  let collateralVault;
  let revenueManager;
  let liquidateManager;
  let orderBook;
  let paymentToken;
  let owner, seller, buyer, buyer2, provider;

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
  const INVALID_TIMESTAMP = 0;

  beforeEach(async function () {
    [owner, seller, buyer, buyer2, provider] = await ethers.getSigners();

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
    await revenueManager.setUnitSeconds(2); // TimeUnit.DAY

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
    
    // 7. 设置 OrderBook
    await assetToken.setOrderBook(await orderBook.getAddress());
    await orderBook.setAssetToken(await assetToken.getAddress());

    // 8. Seller 购买份额
    const sellerPurchaseShares = ethers.parseUnits("100000", 18);
    const sellerPayment = (sellerPurchaseShares * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
    await paymentToken.connect(seller).approve(
      await assetToken.getAddress(),
      sellerPayment
    );
    await assetToken.connect(seller).purchase(sellerPurchaseShares);

    // Buyer 购买份额（用于后续测试）
    const buyerPurchaseShares = ethers.parseUnits("100000", 18);
    const buyerPayment = (buyerPurchaseShares * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
    await paymentToken.connect(buyer).approve(
      await assetToken.getAddress(),
      buyerPayment
    );
    await assetToken.connect(buyer).purchase(buyerPurchaseShares);

    // 完成剩余份额
    const remainingShares = MAX_TOTAL_SUPPLY - sellerPurchaseShares - buyerPurchaseShares;
    const remainingPayment = (remainingShares * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
    await paymentToken.connect(provider).approve(
      await assetToken.getAddress(),
      remainingPayment
    );
    await assetToken.connect(provider).purchase(remainingShares);
  });

  describe("场景1: withdrawDividend -> sellShares -> payOrder 完整流程", function () {
    beforeEach(async function () {
      // 等待售罄后冷却期
      await time.increase(DAY + 1);
    });

    it("应该正确处理分红提取、卖单创建和订单成交的完整流程", async function () {
      // 1. 等待一段时间后提供收益
      await time.increase(1 * DAY);
      
      const revenueAmount = ethers.parseUnits("10000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      // 2. 等待一段时间产生分红
      await time.increase(2 * DAY);

      // 3. 卖家查看自己的份额
      const sellerSharesBefore = await assetToken.balanceOf(seller.address);
      console.log("卖家持有份额:", ethers.formatUnits(sellerSharesBefore, 18));

      // 4. 卖家创建卖单（会自动提取分红）
      const sellAmount = ethers.parseUnits("50000", 18);
      const sellPrice = ethers.parseUnits("0.8", 18); // 0.8 USDT per token
      
      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(seller).sellShares(
        sellAmount,
        sellPrice,
        seller.address
      );
      
      // 验证分红已提取
      const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);
      const receivedDividend = sellerBalanceAfter - sellerBalanceBefore;
      console.log("实际收到分红:", ethers.formatUnits(receivedDividend, 6));
      expect(receivedDividend).to.be.gt(0);

      // 获取订单ID（第一个订单）
      const orderId = 1n;
      console.log("创建订单ID:", orderId);

      // 5. 等待一段时间，让订单期间产生分红
      await time.increase(2 * DAY);
      
      // 再提供一些收益
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      // 6. 买家支付订单
      const purchaseAmount = ethers.parseUnits("30000", 18);
      const paymentAmount = (purchaseAmount * sellPrice) / ethers.parseUnits("1", 18);
      const adjustedPayment = paymentAmount / ethers.parseUnits("1", 12); // 18位转6位

      await paymentToken.connect(buyer2).approve(
        await assetToken.getAddress(),
        adjustedPayment
      );

      const sellerBalanceBefore2 = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(buyer2).payOrder(orderId, purchaseAmount);
      const sellerBalanceAfter2 = await paymentToken.balanceOf(seller.address);

      // 验证卖家收到货款 + 订单期间分红
      const totalReceived = sellerBalanceAfter2 - sellerBalanceBefore2;
      console.log("卖家收到货款+分红:", ethers.formatUnits(totalReceived, 6));
      expect(totalReceived).to.be.gte(adjustedPayment);

      // 验证买家收到份额
      const buyer2Shares = await assetToken.balanceOf(buyer2.address);
      expect(buyer2Shares).to.equal(purchaseAmount);
      console.log("买家收到份额:", ethers.formatUnits(buyer2Shares, 18));

      // 验证订单状态
      const orderInfo = await orderBook.getOrder(orderId);
      expect(orderInfo.filledAmount).to.equal(purchaseAmount);
      console.log("订单成交数量:", ethers.formatUnits(orderInfo.filledAmount, 18));
    });
  });

  describe("场景2: sellShares -> cancelOrder 流程", function () {
    beforeEach(async function () {
      // 等待售罄后冷却期
      await time.increase(DAY + 1);
    });

    it("应该正确处理卖单创建和取消的流程", async function () {
      // 1. 提供收益并等待
      const revenueAmount = ethers.parseUnits("10000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());
      
      await time.increase(3 * DAY);

      // 2. 创建卖单
      const sellAmount = ethers.parseUnits("50000", 18);
      const sellPrice = ethers.parseUnits("0.8", 18);
      
      const sellerSharesBefore = await assetToken.balanceOf(seller.address);
      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      
      await assetToken.connect(seller).sellShares(
        sellAmount,
        sellPrice,
        seller.address
      );
      const orderId = 1n;

      const sellerBalanceAfter1 = await paymentToken.balanceOf(seller.address);
      const dividendReceived = sellerBalanceAfter1 - sellerBalanceBefore;
      console.log("创建订单时收到分红:", ethers.formatUnits(dividendReceived, 6));

      // 验证份额已冻结（ERC20 余额不变，但frozenAmounts增加）
      const frozenAmount = await assetToken.frozenAmounts(seller.address);
      expect(frozenAmount).to.equal(sellAmount);
      const sellerSharesAfter = await assetToken.balanceOf(seller.address);
      expect(sellerSharesAfter).to.equal(sellerSharesBefore); // ERC20余额不变

      // 3. 等待一段时间
      await time.increase(2 * DAY);

      // 4. 取消订单
      await assetToken.connect(seller).cancelOrder(orderId);

      // 5. 验证份额已解冻
      const frozenAmountAfter = await assetToken.frozenAmounts(seller.address);
      expect(frozenAmountAfter).to.equal(0); // 冻结金额已清零
      const sellerSharesFinal = await assetToken.balanceOf(seller.address);
      expect(sellerSharesFinal).to.equal(sellerSharesBefore); // ERC20余额不变
      console.log("取消订单后份额:", ethers.formatUnits(sellerSharesFinal, 18));

      // 6. 验证可以再次提取订单期间的分红
      await time.increase(1 * DAY);
      
      // 再添加一些收益
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());
      
      const sellerBalanceBefore2 = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(seller).withdrawDividend(seller.address, seller.address);
      const sellerBalanceAfter2 = await paymentToken.balanceOf(seller.address);
      
      const dividendAfterCancel = sellerBalanceAfter2 - sellerBalanceBefore2;
      console.log("取消订单后提取分红:", ethers.formatUnits(dividendAfterCancel, 6));
      expect(dividendAfterCancel).to.be.gt(0);
    });

  });

  describe("场景3: 多次交易流程", function () {
    beforeEach(async function () {
      // 等待售罄后冷却期
      await time.increase(DAY + 1);
    });

    it("应该正确处理卖家多次出售和买家多次购买", async function () {
      // 1. 提供收益
      const revenueAmount = ethers.parseUnits("10000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      await time.increase(2 * DAY);

      // 2. 第一次卖单
      const sellAmount1 = ethers.parseUnits("30000", 18);
      const sellPrice1 = ethers.parseUnits("0.8", 18);
      
      await assetToken.connect(seller).sellShares(
        sellAmount1,
        sellPrice1,
        seller.address
      );
      const orderId1 = 1n;

      await time.increase(1 * DAY);

      // 3. 第一次成交
      const payment1 = (sellAmount1 * sellPrice1) / ethers.parseUnits("1", 18) / ethers.parseUnits("1", 12);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer2).payOrder(orderId1, sellAmount1);

      const buyer2Shares1 = await assetToken.balanceOf(buyer2.address);
      console.log("买家第一次购买后份额:", ethers.formatUnits(buyer2Shares1, 18));

      await time.increase(2 * DAY);

      // 4. 第二次卖单
      const sellAmount2 = ethers.parseUnits("20000", 18);
      const sellPrice2 = ethers.parseUnits("0.85", 18);
      
      await assetToken.connect(seller).sellShares(
        sellAmount2,
        sellPrice2,
        seller.address
      );
      const orderId2 = 2n;

      await time.increase(1 * DAY);

      // 5. 第二次成交
      const payment2 = (sellAmount2 * sellPrice2) / ethers.parseUnits("1", 18) / ethers.parseUnits("1", 12);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer2).payOrder(orderId2, sellAmount2);

      const buyer2Shares2 = await assetToken.balanceOf(buyer2.address);
      console.log("买家第二次购买后份额:", ethers.formatUnits(buyer2Shares2, 18));

      // 验证买家总份额
      expect(buyer2Shares2).to.equal(sellAmount1 + sellAmount2);

      // 6. 买家提取分红
      await time.increase(2 * DAY);
      
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      const buyer2BalanceBefore = await paymentToken.balanceOf(buyer2.address);
      await assetToken.connect(buyer2).withdrawDividend(buyer2.address, buyer2.address);
      const buyer2BalanceAfter = await paymentToken.balanceOf(buyer2.address);

      const buyer2Dividend = buyer2BalanceAfter - buyer2BalanceBefore;
      console.log("买家提取分红:", ethers.formatUnits(buyer2Dividend, 6));
      expect(buyer2Dividend).to.be.gt(0);
    });
  });

  describe("场景4: 多轮分红后的交易", function () {
    beforeEach(async function () {
      // 等待售罄后冷却期
      await time.increase(DAY + 1);
    });

    it("应该正确处理多轮分红后的卖单创建和成交", async function () {
      // 1. 第一轮分红
      const revenueAmount1 = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount1
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount1);
      await revenueManager.recordPeriodRevenue(revenueAmount1, await time.latest());

      await time.increase(2 * DAY);

      // 2. 第二轮分红
      const revenueAmount2 = ethers.parseUnits("8000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount2
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount2);
      await revenueManager.recordPeriodRevenue(revenueAmount2, await time.latest());

      await time.increase(1 * DAY);

      // 3. 卖家创建卖单（应该提取所有分红）
      const sellAmount = ethers.parseUnits("40000", 18);
      const sellPrice = ethers.parseUnits("0.75", 18);

      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(seller).sellShares(
        sellAmount,
        sellPrice,
        seller.address
      );
      const orderId = 1n;

      const sellerBalanceAfter1 = await paymentToken.balanceOf(seller.address);
      const receivedDividend = sellerBalanceAfter1 - sellerBalanceBefore;
      console.log("创建订单时收到分红:", ethers.formatUnits(receivedDividend, 6));
      expect(receivedDividend).to.be.gt(0);

      // 4. 第三轮分红
      await time.increase(2 * DAY);
      const revenueAmount3 = ethers.parseUnits("6000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount3
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount3);
      await revenueManager.recordPeriodRevenue(revenueAmount3, await time.latest());

      // 5. 买家支付订单（卖家应该收到订单期间的分红）
      const paymentAmount = (sellAmount * sellPrice) / ethers.parseUnits("1", 18) / ethers.parseUnits("1", 12);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), paymentAmount);

      const sellerBalanceBefore2 = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(buyer2).payOrder(orderId, sellAmount);
      const sellerBalanceAfter2 = await paymentToken.balanceOf(seller.address);

      const totalReceived = sellerBalanceAfter2 - sellerBalanceBefore2;
      console.log("成交时收到货款+订单期间分红:", ethers.formatUnits(totalReceived, 6));
      
      // 应该包含货款和订单期间的分红
      expect(totalReceived).to.be.gte(paymentAmount);

      // 6. 买家持有一段时间后提取
      await time.increase(2 * DAY);
      
      // 第四轮分红
      const revenueAmount4 = ethers.parseUnits("7000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount4
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount4);
      await revenueManager.recordPeriodRevenue(revenueAmount4, await time.latest());

      const buyer2BalanceBefore = await paymentToken.balanceOf(buyer2.address);
      await assetToken.connect(buyer2).withdrawDividend(buyer2.address, buyer2.address);
      const buyer2BalanceAfter = await paymentToken.balanceOf(buyer2.address);

      const buyer2Dividend = buyer2BalanceAfter - buyer2BalanceBefore;
      console.log("买家提取分红:", ethers.formatUnits(buyer2Dividend, 6));
      expect(buyer2Dividend).to.be.gt(0);
    });
  });

  describe("场景5: 份额合并逻辑验证", function () {
    it("应该正确处理多个份额持有者之间的交易", async function () {
      // 等待售罄后冷却期
      await time.increase(DAY + 1);

      // 买家和卖家都已经持有份额（在 beforeEach 中购买）
      const sellerShares = await assetToken.balanceOf(seller.address);
      const buyerShares = await assetToken.balanceOf(buyer.address);
      console.log("卖家份额:", ethers.formatUnits(sellerShares, 18));
      console.log("买家份额:", ethers.formatUnits(buyerShares, 18));

      // 1. 等待后提供收益
      await time.increase(3 * DAY);
      const revenueAmount = ethers.parseUnits("10000", 6);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      await revenueManager.recordPeriodRevenue(revenueAmount, await time.latest());

      await time.increase(2 * DAY);

      // 2. 卖家提取分红后创建卖单
      const sellAmount = ethers.parseUnits("30000", 18);
      const sellPrice = ethers.parseUnits("0.9", 18);
      
      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, seller.address);
      const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);
      
      const dividendReceived = sellerBalanceAfter - sellerBalanceBefore;
      console.log("卖家提取分红:", ethers.formatUnits(dividendReceived, 6));
      expect(dividendReceived).to.be.gt(0);

      // 3. 再等待一段时间，确保买家成交时有更新的收益记录
      await time.increase(1 * DAY);

      // 4. 买家购买并验证份额
      const orderId = 1n;
      const paymentAmount = (sellAmount * sellPrice) / ethers.parseUnits("1", 18) / ethers.parseUnits("1", 12);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), paymentAmount);
      
      const buyer2SharesBefore = await assetToken.balanceOf(buyer2.address);
      await assetToken.connect(buyer2).payOrder(orderId, sellAmount);
      const buyer2SharesAfter = await assetToken.balanceOf(buyer2.address);
      
      expect(buyer2SharesAfter).to.equal(buyer2SharesBefore + sellAmount);
      console.log("买家购买后份额:", ethers.formatUnits(buyer2SharesAfter, 18));
    });
  });

  describe("场景6: 边界条件测试", function () {
    beforeEach(async function () {
      // 等待售罄后冷却期
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }
    });

    it("应该拒绝所有无效的参数和操作", async function () {
      // 1. withdrawDividend 参数验证
      await expect(
        assetToken.connect(seller).withdrawDividend(ethers.ZeroAddress, seller.address)
      ).to.be.revertedWith("Invalid recipient");

      await expect(
        assetToken.connect(seller).withdrawDividend(seller.address, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid holder");

      await expect(
        assetToken.connect(seller).withdrawDividend(seller.address, buyer2.address)
      ).to.be.revertedWith("No shares held");

      // 2. payOrder 操作验证 - 使用不存在的订单ID
      const fakeOrderId = 99999n;
      
      // 购买数量为0
      await expect(
        assetToken.connect(buyer2).payOrder(fakeOrderId, 0)
      ).to.be.revertedWith("Purchase amount must be greater than 0");
    });
  });

  describe("场景7: 时间戳和分红计算验证", function () {
    beforeEach(async function () {
      // 等待售罄后冷却期
      await time.increase(DAY + 1);
    });

    it("应该正确跟踪各个时间节点的分红", async function () {
      const revenueAmount = ethers.parseUnits("10000", 6);
      
      // T0: 初始时间
      const t0 = await time.latest();
      console.log("T0 - 初始时间:", t0);

      // T1: 提供第一笔收益
      await time.increase(1 * DAY);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      const t1 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenueAmount, t1);
      console.log("T1 - 第一笔收益:", t1);

      // T2: 创建卖单（应该提取 T0-T1 期间分红）
      await time.increase(2 * DAY);
      const sellAmount = ethers.parseUnits("30000", 18);
      const sellPrice = ethers.parseUnits("1", 18);
      
      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, seller.address);
      const orderId = 1n;
      const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);
      
      const dividend1 = sellerBalanceAfter - sellerBalanceBefore;
      console.log("T2 - 创建卖单时提取分红:", ethers.formatUnits(dividend1, 6));
      expect(dividend1).to.be.gt(0);

      // T3: 提供第二笔收益
      await time.increase(2 * DAY);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        revenueAmount
      );
      await collateralVault.connect(provider).depositRevenue(revenueAmount);
      const t3 = await time.latest();
      await revenueManager.recordPeriodRevenue(revenueAmount, t3);
      console.log("T3 - 第二笔收益:", t3);

      // T4: 成交订单（卖家应该收到 T2-T3 期间分红）
      await time.increase(1 * DAY);
      const paymentAmount = (sellAmount * sellPrice) / ethers.parseUnits("1", 18) / ethers.parseUnits("1", 12);
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), paymentAmount);
      
      const sellerBalanceBefore2 = await paymentToken.balanceOf(seller.address);
      await assetToken.connect(buyer2).payOrder(orderId, sellAmount);
      const sellerBalanceAfter2 = await paymentToken.balanceOf(seller.address);
      
      const totalReceived = sellerBalanceAfter2 - sellerBalanceBefore2;
      console.log("T4 - 订单成交收到货款+分红:", ethers.formatUnits(totalReceived, 6));
      expect(totalReceived).to.be.gte(paymentAmount);

      // T5: 买家持有一段时间后提取
      await time.increase(2 * DAY);
      
      // T5: 等待一段时间后买家提取
      await time.increase(1 * DAY);
      
      const buyer2BalanceBefore = await paymentToken.balanceOf(buyer2.address);
      await assetToken.connect(buyer2).withdrawDividend(buyer2.address, buyer2.address);
      const buyer2BalanceAfter = await paymentToken.balanceOf(buyer2.address);

      const buyer2Dividend = buyer2BalanceAfter - buyer2BalanceBefore;
      console.log("T5 - 买家提取分红:", ethers.formatUnits(buyer2Dividend, 6));
      // 买家可能没有分红，因为他们是最近才获得份额的
      console.log("买家分红（可能为0，因为刚购买）:", ethers.formatUnits(buyer2Dividend, 6));
    });
  });
});

