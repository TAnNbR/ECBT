const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AssetToken sellShares 函数测试 (集成测试)", function () {
  let assetToken;
  let collateralVault;
  let revenueManager;
  let liquidateManager;
  let orderBook;
  let paymentToken;
  let owner, seller, buyer, provider, recipient;

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
    [owner, seller, buyer, provider, recipient] = await ethers.getSigners();

    // 1. 部署 Mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await paymentToken.waitForDeployment();

    await paymentToken.mint(seller.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(buyer.address, ethers.parseUnits("600000", 6));
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
    const feeCollector = owner.address; // 使用 owner 作为手续费收集者
    const feeRate = 50; // 0.5% (50 / 10000)
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
  });

  describe("基本卖单创建", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      const currentTime = await time.latest();
      const requiredTime = Number(soldOutTime) + DAY + 1;
      if (currentTime < requiredTime) {
        await time.increase(requiredTime - currentTime);
      }
    });

    it("应该成功创建卖单", async function () {
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18); // 0.6 USDT per token

      const tx = await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const receipt = await tx.wait();

      // 验证返回的订单ID
      const orderId = 1n; // 第一个订单ID

      // 验证订单创建
      const order = await orderBook.getOrder(orderId);
      expect(order.seller).to.equal(seller.address); // seller 是实际的卖家地址
      expect(order.amount).to.equal(sellAmount);
      expect(order.price).to.equal(sellPrice);
      expect(order.status).to.equal(0); // Active

      // 验证冻结金额
      const frozenAmount = await assetToken.frozenAmounts(seller.address);
      expect(frozenAmount).to.equal(sellAmount);

      // 验证 holderOrders 记录
      const orders = await assetToken.holderOrders(seller.address, 0);
      expect(orders).to.equal(orderId);

      // 验证授权额度
      const allowance = await assetToken.allowance(seller.address, await assetToken.getAddress());
      expect(allowance).to.equal(sellAmount);
    });

    it("应该在创建卖单时合并所有份额", async function () {
      const sellAmount = ethers.parseUnits("50000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      // 验证份额信息（withdrawDividend 后应该只剩一个份额记录）
      // 并且出售的份额已从 holderInfo[0] 中减去
      const holderInfo = await assetToken.holderInfo(seller.address, 0);
      expect(holderInfo.shares).to.equal(MAX_TOTAL_SUPPLY - sellAmount);
    });

    it("应该正确传递分红和清算时间到 OrderBook", async function () {
      // 记录一些收益
      await time.increase(DAY * 2);
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 3);

      // 提取一次分红（这会更新 lastDividendTime）
      await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);

      // 等待一段时间，避免 Invalid range 错误
      await time.increase(DAY * 2);

      // 在调用 sellShares 之前获取时间戳
      // 注意：sellShares 会调用 withdrawDividend，这会再次更新时间戳
      // 所以我们应该验证的是 sellShares 调用后的时间戳
      
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      // 验证 OrderBook 中的订单包含正确的时间戳
      // sellShares 内部调用了 withdrawDividend，所以时间戳会被更新
      const holderInfoAfter = await assetToken.holderInfo(seller.address, 0);
      const orderId = 1n;
      const order = await orderBook.getOrder(orderId);
      expect(order.lastDividendTime).to.equal(holderInfoAfter.lastDividendTime);
      expect(order.lastLiquidationClaimTime).to.equal(holderInfoAfter.lastLiquidationClaimTime);
    });

    it("应该在创建卖单前自动提取分红", async function () {
      // 记录收益
      await time.increase(DAY);
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 2);

      const recipientBefore = await paymentToken.balanceOf(recipient.address);

      // 创建卖单（应该自动提取分红）
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      // 验证分红已提取
      expect(recipientAfter - recipientBefore).to.equal(revenue);
    });

    it("应该在创建卖单前自动提取清算金", async function () {
      // 存入抵押金
      const collateralAmount = ethers.parseUnits("100000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), collateralAmount);
      await collateralVault.connect(provider).depositCollateralByProvider(collateralAmount);

      // 记录低收益触发清算
      await time.increase(DAY);
      const lowRevenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), lowRevenue);
      await collateralVault.connect(provider).depositRevenue(lowRevenue);
      await revenueManager.recordPeriodRevenue(lowRevenue, await time.latest());

      await time.increase(QUARTER_CYCLE_DAYS * DAY);
      await liquidateManager.checkQuarterlyRevenue();

      await time.increase(DAY);

      const recipientBefore = await paymentToken.balanceOf(recipient.address);

      // 创建卖单（应该自动提取分红和清算金）
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      // 验证分红和清算金已提取
      const expectedDividend = lowRevenue;
      const expectedLiquidation = collateralAmount * 2000n / 10000n;
      expect(recipientAfter - recipientBefore).to.equal(expectedDividend + expectedLiquidation);
    });
  });

  describe("多次创建卖单", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 2 + 1);
      
      // 记录一些收益以避免 Invalid range 错误
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());
      
      await time.increase(DAY * 2);
    });

    it("应该支持多次创建卖单", async function () {
      const sellAmount1 = ethers.parseUnits("100000", 18);
      const sellPrice1 = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount1, sellPrice1, recipient.address);

      // 等待一段时间，避免第二次调用时 Invalid range
      await time.increase(DAY * 2);

      const sellAmount2 = ethers.parseUnits("200000", 18);
      const sellPrice2 = ethers.parseUnits("0.7", 18);

      await assetToken.connect(seller).sellShares(sellAmount2, sellPrice2, recipient.address);

      // 验证两个订单都已创建
      const order1 = await orderBook.getOrder(1n);
      const order2 = await orderBook.getOrder(2n);

      expect(order1.amount).to.equal(sellAmount1);
      expect(order2.amount).to.equal(sellAmount2);

      // 验证总冻结金额
      const frozenAmount = await assetToken.frozenAmounts(seller.address);
      expect(frozenAmount).to.equal(sellAmount1 + sellAmount2);

      // 验证 holderOrders 包含两个订单
      expect(await assetToken.holderOrders(seller.address, 0)).to.equal(1n);
      expect(await assetToken.holderOrders(seller.address, 1)).to.equal(2n);
    });

    it("应该累加授权额度", async function () {
      const sellAmount1 = ethers.parseUnits("100000", 18);
      const sellAmount2 = ethers.parseUnits("200000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount1, sellPrice, recipient.address);
      
      // 等待一段时间，避免第二次调用时 Invalid range
      await time.increase(DAY * 2);
      
      await assetToken.connect(seller).sellShares(sellAmount2, sellPrice, recipient.address);

      // 验证授权额度累加
      const allowance = await assetToken.allowance(seller.address, await assetToken.getAddress());
      expect(allowance).to.equal(sellAmount1 + sellAmount2);
    });
  });

  describe("参数验证", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 2 + 1);
    });

    it("应该拒绝零数量", async function () {
      const sellAmount = 0;
      const sellPrice = ethers.parseUnits("0.6", 18);

      await expect(
        assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("应该拒绝零价格", async function () {
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = 0;

      await expect(
        assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("应该拒绝份额不足", async function () {
      const sellAmount = MAX_TOTAL_SUPPLY + 1n;
      const sellPrice = ethers.parseUnits("0.6", 18);

      await expect(
        assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address)
      ).to.be.revertedWith("Insufficient shares");
    });

    it("应该拒绝未设置 OrderBook", async function () {
      // 部署一个新的 AssetToken 但不设置 OrderBook
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

      await newAssetToken.setLiquidateManager(await liquidateManager.getAddress());

      // 给buyer更多代币用于购买
      await paymentToken.mint(buyer.address, FUNDRAISE_AMOUNT);
      
      // 购买代币（使用buyer而不是seller）
      await paymentToken.connect(buyer).approve(await newAssetToken.getAddress(), FUNDRAISE_AMOUNT);
      await newAssetToken.connect(buyer).purchase(MAX_TOTAL_SUPPLY);

      const soldOutTime = await newAssetToken.soldOutTimestamp();
      await time.increase(DAY * 3 + 1);

      // 尝试创建卖单（应该失败，因为未设置 OrderBook）
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await expect(
        newAssetToken.connect(buyer).sellShares(sellAmount, sellPrice, recipient.address)
      ).to.be.revertedWith("OrderBook not set");
    });
  });

  describe("售罄前的限制", function () {
    it("应该在售罄前拒绝创建卖单（因为 withdrawDividend 需要售罄）", async function () {
      // seller 只购买部分代币（不触发售罄）
      const partialAmount = ethers.parseUnits("500000", 18);
      const partialPayment = (partialAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), partialPayment);
      await assetToken.connect(seller).purchase(partialAmount);

      // 尝试创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      // 应该失败，因为 withdrawDividend 有 onlySoldOut 修饰符
      await expect(
        assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address)
      ).to.be.revertedWith("Token not sold out yet");
    });
  });

  describe("边界条件测试", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 2 + 1);
    });

    it("应该支持出售全部份额", async function () {
      const sellAmount = MAX_TOTAL_SUPPLY;
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      // 验证订单创建
      const order = await orderBook.getOrder(1n);
      expect(order.amount).to.equal(MAX_TOTAL_SUPPLY);

      // 验证冻结金额
      const frozenAmount = await assetToken.frozenAmounts(seller.address);
      expect(frozenAmount).to.equal(MAX_TOTAL_SUPPLY);
    });

    it("应该支持极小金额的卖单", async function () {
      const sellAmount = 1n; // 1 wei
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      // 验证订单创建
      const order = await orderBook.getOrder(1n);
      expect(order.amount).to.equal(1n);
    });

    it("应该支持高价格的卖单", async function () {
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("1000", 18); // 1000 USDT per token

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      // 验证订单创建
      const order = await orderBook.getOrder(1n);
      expect(order.price).to.equal(sellPrice);
    });
  });

  describe("复杂场景测试", function () {
    it("应该正确处理：购买 -> 收益 -> 提取 -> 再次购买 -> 创建卖单", async function () {
      // 第一次购买一半
      const amount1 = MAX_TOTAL_SUPPLY / 2n;
      const payment1 = FUNDRAISE_AMOUNT / 2n;
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(seller).purchase(amount1);

      await time.increase(DAY * 2);

      // 第二次购买另一半（触发售罄）
      const amount2 = MAX_TOTAL_SUPPLY - amount1;
      const payment2 = FUNDRAISE_AMOUNT - payment1;
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(seller).purchase(amount2);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 3 + 1);

      // 记录收益
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 3);

      // 先提取一次分红
      await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);

      // 等待一段时间，避免 Invalid range
      await time.increase(DAY * 2);

      // 创建卖单（应该再次触发 withdrawDividend，但这次没有新收益）
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);
      
      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      // 验证没有新的收益提取
      expect(recipientAfter - recipientBefore).to.equal(0);

      // 验证卖单创建成功
      const order = await orderBook.getOrder(1n);
      expect(order.amount).to.equal(sellAmount);
    });
  });

  describe("cancelOrder 函数测试", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 2 + 1);
    });

    it("应该成功取消订单", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 验证订单创建
      let order = await orderBook.getOrder(orderId);
      expect(order.status).to.equal(0); // Active

      // 取消订单
      await assetToken.connect(seller).cancelOrder(orderId);

      // 验证订单状态更新
      order = await orderBook.getOrder(orderId);
      expect(order.status).to.equal(2); // Cancelled
    });

    it("取消订单后应该恢复份额", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 取消前：只有1个 holderInfo（sellShares 合并后，已减去出售份额）
      const holderInfo1 = await assetToken.holderInfo(seller.address, 0);
      expect(holderInfo1.shares).to.equal(MAX_TOTAL_SUPPLY - sellAmount);

      // 取消订单
      await assetToken.connect(seller).cancelOrder(orderId);

      // 取消后：应该有2个 holderInfo（原有的 + 取消退还的）
      const holderInfo2 = await assetToken.holderInfo(seller.address, 0);
      const holderInfo3 = await assetToken.holderInfo(seller.address, 1);

      // 第一个保持不变（仍是减去出售份额后的值）
      expect(holderInfo2.shares).to.equal(MAX_TOTAL_SUPPLY - sellAmount);
      
      // 第二个是退还的份额
      expect(holderInfo3.shares).to.equal(sellAmount);
    });

    it("取消订单后应该保留订单创建时的时间戳", async function () {
      // 记录收益并提取（更新时间戳）
      await time.increase(DAY);
      const revenue = ethers.parseUnits("5000", 6);
      await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
      await collateralVault.connect(provider).depositRevenue(revenue);
      await revenueManager.recordPeriodRevenue(revenue, await time.latest());

      await time.increase(DAY * 2);
      await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);

      await time.increase(DAY * 2);

      // 获取提取后的时间戳
      const holderInfoBefore = await assetToken.holderInfo(seller.address, 0);
      const lastDividendTimeBefore = holderInfoBefore.lastDividendTime;
      const lastClaimTimeBefore = holderInfoBefore.lastLiquidationClaimTime;

      // 创建卖单（会再次调用 withdrawDividend，时间戳会更新）
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 获取订单中保存的时间戳
      const order = await orderBook.getOrder(orderId);
      const orderLastDividendTime = order.lastDividendTime;
      const orderLastClaimTime = order.lastLiquidationClaimTime;

      // 等待一段时间
      await time.increase(DAY * 2);

      // 取消订单
      await assetToken.connect(seller).cancelOrder(orderId);

      // 验证退还的份额使用订单创建时的时间戳
      const holderInfoAfter = await assetToken.holderInfo(seller.address, 1);
      expect(holderInfoAfter.lastDividendTime).to.equal(orderLastDividendTime);
      expect(holderInfoAfter.lastLiquidationClaimTime).to.equal(orderLastClaimTime);
    });

    it("应该正确处理部分成交后的取消", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 模拟部分成交（通过 OrderBook 更新）
      const filledAmount = ethers.parseUnits("30000", 18);
      await orderBook.fillOrder(orderId, filledAmount);

      // 验证部分成交
      let order = await orderBook.getOrder(orderId);
      expect(order.filledAmount).to.equal(filledAmount);

      // 取消订单
      await assetToken.connect(seller).cancelOrder(orderId);

      // 验证退还的份额 = 订单总量 - 已成交量
      const refundAmount = sellAmount - filledAmount;
      const holderInfoRefund = await assetToken.holderInfo(seller.address, 1);
      expect(holderInfoRefund.shares).to.equal(refundAmount);
    });

    it("应该拒绝取消他人的订单", async function () {
      // seller 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // buyer 尝试取消 seller 的订单
      await expect(
        assetToken.connect(buyer).cancelOrder(orderId)
      ).to.be.revertedWith("Not order owner");
    });

    it("应该拒绝取消已完成的订单", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 模拟完全成交
      await orderBook.fillOrder(orderId, sellAmount);

      // 尝试取消已完成的订单
      await expect(
        assetToken.connect(seller).cancelOrder(orderId)
      ).to.be.revertedWith("Order not active");
    });

    it("应该拒绝取消已取消的订单", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 第一次取消
      await assetToken.connect(seller).cancelOrder(orderId);

      // 第二次取消（应该失败）
      await expect(
        assetToken.connect(seller).cancelOrder(orderId)
      ).to.be.revertedWith("Order not active");
    });

    it("应该拒绝在未设置 OrderBook 时取消订单", async function () {
      // 部署新的 AssetToken 但不设置 OrderBook
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

      // 尝试取消订单（应该失败，因为未设置 OrderBook）
      await expect(
        newAssetToken.connect(seller).cancelOrder(1n)
      ).to.be.revertedWith("OrderBook not set");
    });

    it("全部成交后取消订单应该不退还份额", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 完全成交
      await orderBook.fillOrder(orderId, sellAmount);

      // 此时订单状态变为 Filled，无法取消
      await expect(
        assetToken.connect(seller).cancelOrder(orderId)
      ).to.be.revertedWith("Order not active");
    });
  });

  describe("cancelOrder 与分红/清算集成测试", function () {
    beforeEach(async function () {
      // seller 购买全部代币触发售罄
      await paymentToken.connect(seller).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(seller).purchase(MAX_TOTAL_SUPPLY);

      // 等待售罄后
      const soldOutTime = await assetToken.soldOutTimestamp();
      await time.increase(DAY * 2 + 1);
    });
    
    describe("取消订单后，退还的份额应该可以继续提取期间的分红", function () {
        it("售罄后无分红", async function () {

            const sellAmount = ethers.parseUnits("200000", 18);
            const sellPrice = ethers.parseUnits("0.6", 18);
    
            await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const orderId = 1n;
    
            await time.increase(DAY * 2);
    
            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId);
    
            await time.increase(DAY * 2);
    
            // 提取分红（应该获得 revenue）
            const recipientBefore = await paymentToken.balanceOf(recipient.address);
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);
            const recipientAfter = await paymentToken.balanceOf(recipient.address);
    
            // 验证：前后余额相等
            expect(recipientBefore).to.equal(recipientAfter);
        });

        it("售罄后单笔分红", async function () {

            const sellAmount = ethers.parseUnits("200000", 18);
            const sellPrice = ethers.parseUnits("0.6", 18);

            await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const orderId = 1n;

            // 记录收益（订单创建后）
            await time.increase(DAY * 2);
            const revenue = ethers.parseUnits("3000", 6);
            await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue);
            await collateralVault.connect(provider).depositRevenue(revenue);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());

            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId);

            await time.increase(DAY * 2);

            // 提取分红（应该获得 revenue）
            const recipientBefore = await paymentToken.balanceOf(recipient.address);
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);
            const recipientAfter = await paymentToken.balanceOf(recipient.address);

            const received = recipientAfter - recipientBefore;

            // 验证：由于是100%持有，应该获得全部收益
            expect(received).to.equal(revenue);
        });

        it("售罄后多笔分红", async function () {

            const sellAmount = ethers.parseUnits("200000", 18);
            const sellPrice = ethers.parseUnits("0.6", 18);

            await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const orderId = 1n;

            // 记录收益（订单创建后）
            await time.increase(DAY * 2);
            const revenue = ethers.parseUnits("3000", 6);
            await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue * 3n);
            await collateralVault.connect(provider).depositRevenue(revenue * 3n);

            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId);

            await time.increase(DAY * 2);

            // 提取分红（应该获得 revenue）
            const recipientBefore = await paymentToken.balanceOf(recipient.address);
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);
            const recipientAfter = await paymentToken.balanceOf(recipient.address);

            const received = recipientAfter - recipientBefore;

            // 验证：由于是100%持有，应该获得全部收益
            expect(received).to.equal(revenue * 3n);
        });

        it("已领取过分红，再次领取时期间内没有新分红", async function () {
            
            const sellAmount = ethers.parseUnits("200000", 18);
            const sellPrice = ethers.parseUnits("0.6", 18);

            await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const orderId = 1n;

            // 记录收益（订单创建后）
            await time.increase(DAY * 2);
            const revenue = ethers.parseUnits("3000", 6);
            await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue * 3n);
            await collateralVault.connect(provider).depositRevenue(revenue * 3n);

            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId);

            await time.increase(DAY * 2);

            // 提取分红（应该获得 revenue）
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);

            // 等待一段时间后再次创建卖单（期间没有新分红）
            await time.increase(DAY * 2);

            // 创建第二个卖单并通过事件获取 orderId
            await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);

            
            const orderId2 = 2n;

            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId2);
            await time.increase(DAY * 2);

            const recipientBefore = await paymentToken.balanceOf(recipient.address);
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);
            const recipientAfter = await paymentToken.balanceOf(recipient.address);


            const received = recipientAfter - recipientBefore;

            // 验证：由于是100%持有，应该获得全部收益
            expect(received).to.equal(0);
        });

        it("已领取过分红，再次领取时期间内有一次分红", async function () {
            
            const sellAmount = ethers.parseUnits("200000", 18);
            const sellPrice = ethers.parseUnits("0.6", 18);

            await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const orderId = 1n;

            // 记录收益（订单创建后）
            await time.increase(DAY * 2);
            const revenue = ethers.parseUnits("3000", 6);
            await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue * 4n);
            await collateralVault.connect(provider).depositRevenue(revenue * 4n);

            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId);

            await time.increase(DAY * 2);

            // 提取分红（应该获得 revenue）
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);

            // 等待一段时间后再次创建卖单（期间没有新分红）
            await time.increase(DAY * 2);

            // 创建第二个卖单并通过事件获取 orderId
            const tx = await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const receipt = await tx.wait();
            
            // 从 OrderBook 的 OrderCreated 事件中获取 orderId
            const orderBookAddress = await assetToken.orderBook();
            const orderBookContract = await ethers.getContractAt("OrderBook", orderBookAddress);
            const orderCreatedEvent = receipt.logs
                .map(log => {
                    try {
                        return orderBookContract.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find(event => event && event.name === "OrderCreated");
            
            const orderId2 = orderCreatedEvent.args.orderId;

            await time.increase(DAY * 2);

            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId2);
            await time.increase(DAY * 2);

            const recipientBefore = await paymentToken.balanceOf(recipient.address);
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);
            const recipientAfter = await paymentToken.balanceOf(recipient.address);


            const received = recipientAfter - recipientBefore;

            // 验证：由于是100%持有，应该获得全部收益
            expect(received).to.equal(revenue);
        });

        it("已领取过分红，再次领取时期间内有多次分红", async function () {
            
            const sellAmount = ethers.parseUnits("200000", 18);
            const sellPrice = ethers.parseUnits("0.6", 18);

            await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const orderId = 1n;

            // 记录收益（订单创建后）
            await time.increase(DAY * 2);
            const revenue = ethers.parseUnits("3000", 6);
            await paymentToken.connect(provider).approve(await collateralVault.getAddress(), revenue * 5n);
            await collateralVault.connect(provider).depositRevenue(revenue * 5n);

            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId);

            await time.increase(DAY * 2);

            // 提取分红（应该获得 revenue）
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);

            // 等待一段时间后再次创建卖单（期间没有新分红）
            await time.increase(DAY * 2);

            // 创建第二个卖单并通过事件获取 orderId
            const tx = await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
            const receipt = await tx.wait();
            
            // 从 OrderBook 的 OrderCreated 事件中获取 orderId
            const orderBookAddress = await assetToken.orderBook();
            const orderBookContract = await ethers.getContractAt("OrderBook", orderBookAddress);
            const orderCreatedEvent = receipt.logs
                .map(log => {
                    try {
                        return orderBookContract.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find(event => event && event.name === "OrderCreated");
            
            const orderId2 = orderCreatedEvent.args.orderId;

            await time.increase(DAY * 2);

            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);
            await revenueManager.recordPeriodRevenue(revenue, await time.latest());
            await time.increase(DAY * 2);

            // 取消订单
            await assetToken.connect(seller).cancelOrder(orderId2);
            await time.increase(DAY * 2);

            const recipientBefore = await paymentToken.balanceOf(recipient.address);
            await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);
            const recipientAfter = await paymentToken.balanceOf(recipient.address);


            const received = recipientAfter - recipientBefore;

            // 验证：由于是100%持有，应该获得全部收益
            expect(received).to.equal(revenue * 2n);
        });

    });

    it("取消订单后，退还的份额应该可以继续提取期间的清算金", async function () {
      // TODO: 此测试涉及复杂的清算金计算逻辑，需要进一步调试
      // 问题：withdrawDividend 在 sellShares 和手动调用时可能导致重复计算
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

      // 取消订单
      await assetToken.connect(seller).cancelOrder(orderId);

      await time.increase(DAY * 2);

      // 提取清算金
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      await assetToken.connect(seller).withdrawDividend(recipient.address, seller.address);
      const recipientAfter = await paymentToken.balanceOf(recipient.address);

      const received = recipientAfter - recipientBefore;

      // 验证：应该获得清算金（100%持有）
      const expectedLiquidation = collateralAmount * 2000n / 10000n;
      expect(received).to.be.greaterThan(0);
      expect(received).to.equal(expectedLiquidation);
    });

    it("部分成交后取消，应该只退还未成交部分", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 部分成交
      const filledAmount = ethers.parseUnits("30000", 18);
      await orderBook.fillOrder(orderId, filledAmount);

      // 取消订单
      await assetToken.connect(seller).cancelOrder(orderId);

      // 验证退还的份额 = 订单总量 - 已成交量
      const refundAmount = sellAmount - filledAmount;
      const holderInfoRefund = await assetToken.holderInfo(seller.address, 1);
      expect(holderInfoRefund.shares).to.equal(refundAmount);
    });

    it("零退还金额时应该不创建新的 holderInfo", async function () {
      // 创建卖单
      const sellAmount = ethers.parseUnits("100000", 18);
      const sellPrice = ethers.parseUnits("0.6", 18);

      await assetToken.connect(seller).sellShares(sellAmount, sellPrice, recipient.address);
      const orderId = 1n;

      // 完全成交
      await orderBook.fillOrder(orderId, sellAmount);

      // 此时订单已完成，无法取消
      // 但如果能取消，refundAmount = 0，不应该创建新的 holderInfo
      await expect(
        assetToken.connect(seller).cancelOrder(orderId)
      ).to.be.revertedWith("Order not active");
    });
  });
});

