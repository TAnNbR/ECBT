const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetToken - payOrder frozenAmount Bug Fix", function () {
  let assetToken, orderBook, paymentToken, collateralVault, revenueManager, liquidateManager;
  let deployer, seller, buyer;

  const PAYMENT_TOKEN_DECIMALS = 6;
  const DAY = 86400;
  const INVALID_TIMESTAMP = 0;

  beforeEach(async function () {
    [deployer, seller, buyer] = await ethers.getSigners();

    // 部署 MockERC20 (USDT)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", PAYMENT_TOKEN_DECIMALS);

    // 部署 CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    collateralVault = await CollateralVault.deploy(await paymentToken.getAddress());

    // 部署 RevenueManager
    const RevenueManager = await ethers.getContractFactory("RevenueManager");
    revenueManager = await RevenueManager.deploy(await collateralVault.getAddress(), DAY);

    // 部署 LiquidateManager
    const LiquidateManager = await ethers.getContractFactory("LiquidateManager");
    liquidateManager = await LiquidateManager.deploy(await collateralVault.getAddress(), DAY);

    // 部署 OrderBook
    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy();

    // 部署 AssetToken
    const AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy();

    // 初始化 AssetToken
    const metadata = {
      name: "Test Asset",
      symbol: "TASSET",
      paymentToken: await paymentToken.getAddress(),
      totalValue: ethers.parseUnits("1000000", PAYMENT_TOKEN_DECIMALS),
      fundraiseAmount: ethers.parseUnits("500000", PAYMENT_TOKEN_DECIMALS),
      maxTotalSupply: ethers.parseUnits("1000000", 18),
      dividendStartTime: INVALID_TIMESTAMP,
      lastUpdateTime: INVALID_TIMESTAMP,
      soldOutTimestamp: INVALID_TIMESTAMP,
    };

    await assetToken.initialize(
      metadata,
      await collateralVault.getAddress(),
      await revenueManager.getAddress(),
      await liquidateManager.getAddress(),
      await orderBook.getAddress()
    );

    // 设置权限
    await collateralVault.setAssetToken(await assetToken.getAddress());
    await revenueManager.setAssetToken(await assetToken.getAddress());
    await orderBook.setAssetToken(await assetToken.getAddress());

    // 给买家铸造 USDT
    await paymentToken.mint(buyer.address, ethers.parseUnits("1000000", PAYMENT_TOKEN_DECIMALS));
    await paymentToken.connect(buyer).approve(await assetToken.getAddress(), ethers.MaxUint256);

    // 给卖家购买代币
    await paymentToken.mint(seller.address, ethers.parseUnits("1000000", PAYMENT_TOKEN_DECIMALS));
    await paymentToken.connect(seller).approve(await collateralVault.getAddress(), ethers.MaxUint256);
    await assetToken.connect(seller).purchase(ethers.parseUnits("500000", 18));
  });

  it("应该在订单成交时正确解冻 frozenAmount", async function () {
    const sellAmount = ethers.parseUnits("100000", 18);
    const sellPrice = ethers.parseUnits("1", 18);

    // 1. 卖家创建卖单
    await assetToken.connect(seller).sellShares(sellAmount, sellPrice, seller.address);
    
    // 检查初始 frozenAmount
    let frozenAmount = await assetToken.frozenAmounts(seller.address);
    expect(frozenAmount).to.equal(sellAmount);
    console.log("  创建订单后 frozenAmount:", ethers.formatUnits(frozenAmount, 18));

    // 2. 买家购买部分订单（购买 60000）
    const purchaseAmount = ethers.parseUnits("60000", 18);
    await assetToken.connect(buyer).payOrder(1, purchaseAmount);

    // 检查成交后 frozenAmount（应该减少 60000）
    frozenAmount = await assetToken.frozenAmounts(seller.address);
    const expectedFrozen = sellAmount - purchaseAmount; // 100000 - 60000 = 40000
    expect(frozenAmount).to.equal(expectedFrozen);
    console.log("  购买 60000 后 frozenAmount:", ethers.formatUnits(frozenAmount, 18));
    console.log("  预期:", ethers.formatUnits(expectedFrozen, 18));

    // 3. 买家再购买剩余的（购买 40000）
    const remainingAmount = ethers.parseUnits("40000", 18);
    await assetToken.connect(buyer).payOrder(1, remainingAmount);

    // 检查全部成交后 frozenAmount（应该为 0）
    frozenAmount = await assetToken.frozenAmounts(seller.address);
    expect(frozenAmount).to.equal(0);
    console.log("  全部成交后 frozenAmount:", ethers.formatUnits(frozenAmount, 18));
  });

  it("应该在部分成交后取消订单时，frozenAmount 为 0", async function () {
    const sellAmount = ethers.parseUnits("100000", 18);
    const sellPrice = ethers.parseUnits("1", 18);

    // 1. 创建卖单
    await assetToken.connect(seller).sellShares(sellAmount, sellPrice, seller.address);
    let frozenAmount = await assetToken.frozenAmounts(seller.address);
    expect(frozenAmount).to.equal(sellAmount);
    console.log("  创建订单后 frozenAmount:", ethers.formatUnits(frozenAmount, 18));

    // 2. 部分成交（购买 60000）
    const purchaseAmount = ethers.parseUnits("60000", 18);
    await assetToken.connect(buyer).payOrder(1, purchaseAmount);
    frozenAmount = await assetToken.frozenAmounts(seller.address);
    console.log("  部分成交后 frozenAmount:", ethers.formatUnits(frozenAmount, 18));

    // 3. 取消订单（剩余 40000）
    await assetToken.connect(seller).cancelOrder(1);
    frozenAmount = await assetToken.frozenAmounts(seller.address);
    
    // frozenAmount 应该为 0（60000 在成交时解冻，40000 在取消时解冻）
    expect(frozenAmount).to.equal(0);
    console.log("  取消订单后 frozenAmount:", ethers.formatUnits(frozenAmount, 18));
  });
});

