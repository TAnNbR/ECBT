const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrderBook 合约测试", function () {
  let orderBook;
  let owner, feeCollector, seller, buyer1, buyer2;

  // 测试参数
  const FEE_RATE = 30; // 0.3%
  const AMOUNT = ethers.parseUnits("1000", 18);
  const PRICE = ethers.parseUnits("1.5", 18);
  const LAST_DIVIDEND_TIME = 1000000;
  const LAST_LIQUIDATION_CLAIM_TIME = 900000;

  // 时间常量
  const DAY = 86400;

  beforeEach(async function () {
    [owner, feeCollector, seller, buyer1, buyer2] = await ethers.getSigners();

    // 部署 OrderBook
    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(feeCollector.address, FEE_RATE);
    await orderBook.waitForDeployment();

    console.log("OrderBook deployed to:", await orderBook.getAddress());
    console.log("Fee collector:", feeCollector.address);
    console.log("Fee rate:", FEE_RATE);
  });

  describe("部署和初始化", function () {
    it("应该正确设置手续费收集地址", async function () {
      expect(await orderBook.feeCollector()).to.equal(feeCollector.address);
    });

    it("应该正确设置手续费率", async function () {
      expect(await orderBook.feeRate()).to.equal(FEE_RATE);
    });

    it("应该初始化 nextOrderId 为 1", async function () {
      expect(await orderBook.nextOrderId()).to.equal(1);
    });

    it("不应该接受零地址作为手续费收集地址", async function () {
      const OrderBook = await ethers.getContractFactory("OrderBook");
      await expect(
        OrderBook.deploy(ethers.ZeroAddress, FEE_RATE)
      ).to.be.revertedWith("Invalid fee collector");
    });

    it("不应该接受超过 10% 的手续费率", async function () {
      const OrderBook = await ethers.getContractFactory("OrderBook");
      await expect(
        OrderBook.deploy(feeCollector.address, 1001) // 10.01%
      ).to.be.revertedWith("Fee rate too high");
    });
  });

  describe("创建卖单", function () {
    it("应该成功创建卖单", async function () {
      const tx = await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      // 检查事件
      await expect(tx)
        .to.emit(orderBook, "OrderCreated")
        .withArgs(1, seller.address, AMOUNT, PRICE);

      // 检查订单详情
      const order = await orderBook.getOrder(1);
      expect(order.orderId).to.equal(1);
      expect(order.seller).to.equal(seller.address);
      expect(order.amount).to.equal(AMOUNT);
      expect(order.price).to.equal(PRICE);
      expect(order.filledAmount).to.equal(0);
      expect(order.status).to.equal(0); // OrderStatus.Active
      expect(order.lastDividendTime).to.equal(LAST_DIVIDEND_TIME);
      expect(order.lastLiquidationClaimTime).to.equal(LAST_LIQUIDATION_CLAIM_TIME);
    });

    it("应该递增订单 ID", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      expect(await orderBook.nextOrderId()).to.equal(3);
    });

    it("应该将订单添加到用户订单列表", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(seller).createSellOrder(
        AMOUNT * 2n,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const userOrders = await orderBook.getUserOrders(seller.address);
      expect(userOrders.length).to.equal(2);
      expect(userOrders[0]).to.equal(1);
      expect(userOrders[1]).to.equal(2);
    });

    it("不应该接受零数量", async function () {
      await expect(
        orderBook.connect(seller).createSellOrder(
          0,
          PRICE,
          LAST_DIVIDEND_TIME,
          LAST_LIQUIDATION_CLAIM_TIME
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("不应该接受零价格", async function () {
      await expect(
        orderBook.connect(seller).createSellOrder(
          AMOUNT,
          0,
          LAST_DIVIDEND_TIME,
          LAST_LIQUIDATION_CLAIM_TIME
        )
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("应该正确记录创建时间", async function () {
      const beforeTime = await time.latest();
      
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const afterTime = await time.latest();
      const order = await orderBook.getOrder(1);

      expect(order.createdAt).to.be.gte(beforeTime);
      expect(order.createdAt).to.be.lte(afterTime);
    });

    it("不同用户应该能创建独立的订单", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(buyer1).createSellOrder(
        AMOUNT * 2n,
        PRICE * 2n,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const order1 = await orderBook.getOrder(1);
      const order2 = await orderBook.getOrder(2);

      expect(order1.seller).to.equal(seller.address);
      expect(order2.seller).to.equal(buyer1.address);
      expect(order1.amount).to.equal(AMOUNT);
      expect(order2.amount).to.equal(AMOUNT * 2n);
    });
  });

  describe("成交订单", function () {
    beforeEach(async function () {
      // 创建一个测试订单
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );
    });

    it("应该成功部分成交订单", async function () {
      const fillAmount = AMOUNT / 2n;
      
      const tx = await orderBook.connect(buyer1).fillOrder(1, fillAmount);

      // 检查事件
      await expect(tx)
        .to.emit(orderBook, "OrderFilled")
        .withArgs(1, buyer1.address, fillAmount, AMOUNT - fillAmount, 0);

      // 检查订单状态
      const order = await orderBook.getOrder(1);
      expect(order.filledAmount).to.equal(fillAmount);
      expect(order.status).to.equal(0); // OrderStatus.Active
    });

    it("应该成功完全成交订单", async function () {
      const tx = await orderBook.connect(buyer1).fillOrder(1, AMOUNT);

      // 检查事件
      await expect(tx)
        .to.emit(orderBook, "OrderFilled")
        .withArgs(1, buyer1.address, AMOUNT, 0, 0);

      // 检查订单状态
      const order = await orderBook.getOrder(1);
      expect(order.filledAmount).to.equal(AMOUNT);
      expect(order.status).to.equal(1); // OrderStatus.Filled
    });

    it("应该处理超额成交请求", async function () {
      const overAmount = AMOUNT * 2n;
      
      const tx = await orderBook.connect(buyer1).fillOrder(1, overAmount);

      // 应该只成交可用数量
      await expect(tx)
        .to.emit(orderBook, "OrderFilled")
        .withArgs(1, buyer1.address, AMOUNT, 0, 0);

      const order = await orderBook.getOrder(1);
      expect(order.filledAmount).to.equal(AMOUNT);
      expect(order.status).to.equal(1); // OrderStatus.Filled
    });

    it("应该支持多次部分成交", async function () {
      const firstFill = AMOUNT / 3n;
      const secondFill = AMOUNT / 3n;
      const thirdFill = AMOUNT - firstFill - secondFill;

      await orderBook.connect(buyer1).fillOrder(1, firstFill);
      await orderBook.connect(buyer2).fillOrder(1, secondFill);
      await orderBook.connect(buyer1).fillOrder(1, thirdFill);

      const order = await orderBook.getOrder(1);
      expect(order.filledAmount).to.equal(AMOUNT);
      expect(order.status).to.equal(1); // OrderStatus.Filled
    });

    it("不应该成交零数量", async function () {
      await expect(
        orderBook.connect(buyer1).fillOrder(1, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("不应该成交已完成的订单", async function () {
      await orderBook.connect(buyer1).fillOrder(1, AMOUNT);

      await expect(
        orderBook.connect(buyer2).fillOrder(1, 1)
      ).to.be.revertedWith("Order not active");
    });

    it("不应该成交已取消的订单", async function () {
      await orderBook.connect(seller).cancelOrder(1);

      await expect(
        orderBook.connect(buyer1).fillOrder(1, AMOUNT / 2n)
      ).to.be.revertedWith("Order not active");
    });

    it("不应该成交不存在的订单", async function () {
      await expect(
        orderBook.connect(buyer1).fillOrder(999, AMOUNT)
      ).to.be.revertedWith("Order fully filled");
    });
  });

  describe("取消订单", function () {
    beforeEach(async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );
    });

    it("应该成功取消未成交订单", async function () {
      const tx = await orderBook.connect(seller).cancelOrder(1);

      // 检查事件
      await expect(tx)
        .to.emit(orderBook, "OrderCancelled")
        .withArgs(1, AMOUNT);

      // 检查订单状态
      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(2); // OrderStatus.Cancelled
    });

    it("应该成功取消部分成交订单", async function () {
      const fillAmount = AMOUNT / 3n;
      await orderBook.connect(buyer1).fillOrder(1, fillAmount);

      const refundAmount = AMOUNT - fillAmount;
      const tx = await orderBook.connect(seller).cancelOrder(1);

      // 检查事件
      await expect(tx)
        .to.emit(orderBook, "OrderCancelled")
        .withArgs(1, refundAmount);

      // 检查订单状态
      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(2); // OrderStatus.Cancelled
    });

    it("不应该允许非订单所有者取消订单", async function () {
      await expect(
        orderBook.connect(buyer1).cancelOrder(1)
      ).to.be.revertedWith("Not order owner");
    });

    it("不应该取消已完成的订单", async function () {
      await orderBook.connect(buyer1).fillOrder(1, AMOUNT);

      await expect(
        orderBook.connect(seller).cancelOrder(1)
      ).to.be.revertedWith("Order not active");
    });

    it("不应该取消已取消的订单", async function () {
      await orderBook.connect(seller).cancelOrder(1);

      await expect(
        orderBook.connect(seller).cancelOrder(1)
      ).to.be.revertedWith("Order not active");
    });

    it("不应该取消完全成交的订单", async function () {
      await orderBook.connect(buyer1).fillOrder(1, AMOUNT);

      await expect(
        orderBook.connect(seller).cancelOrder(1)
      ).to.be.revertedWith("Order not active");
    });
  });

  describe("查询功能", function () {
    beforeEach(async function () {
      // 创建多个订单
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(seller).createSellOrder(
        AMOUNT * 2n,
        PRICE * 2n,
        LAST_DIVIDEND_TIME + 1000,
        LAST_LIQUIDATION_CLAIM_TIME + 1000
      );

      await orderBook.connect(buyer1).createSellOrder(
        AMOUNT / 2n,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );
    });

    it("应该正确返回订单详情", async function () {
      const order = await orderBook.getOrder(1);
      
      expect(order.orderId).to.equal(1);
      expect(order.seller).to.equal(seller.address);
      expect(order.amount).to.equal(AMOUNT);
      expect(order.price).to.equal(PRICE);
      expect(order.filledAmount).to.equal(0);
      expect(order.status).to.equal(0);
      expect(order.lastDividendTime).to.equal(LAST_DIVIDEND_TIME);
      expect(order.lastLiquidationClaimTime).to.equal(LAST_LIQUIDATION_CLAIM_TIME);
    });

    it("应该正确返回用户订单列表", async function () {
      const sellerOrders = await orderBook.getUserOrders(seller.address);
      expect(sellerOrders.length).to.equal(2);
      expect(sellerOrders[0]).to.equal(1);
      expect(sellerOrders[1]).to.equal(2);

      const buyer1Orders = await orderBook.getUserOrders(buyer1.address);
      expect(buyer1Orders.length).to.equal(1);
      expect(buyer1Orders[0]).to.equal(3);
    });

    it("空用户应该返回空订单列表", async function () {
      const orders = await orderBook.getUserOrders(buyer2.address);
      expect(orders.length).to.equal(0);
    });

    it("应该正确返回订单剩余数量", async function () {
      expect(await orderBook.getOrderRemainingAmount(1)).to.equal(AMOUNT);
    });

    it("部分成交后应该正确返回剩余数量", async function () {
      const fillAmount = AMOUNT / 3n;
      await orderBook.connect(buyer1).fillOrder(1, fillAmount);

      expect(await orderBook.getOrderRemainingAmount(1)).to.equal(AMOUNT - fillAmount);
    });

    it("完全成交后应该返回零剩余数量", async function () {
      await orderBook.connect(buyer1).fillOrder(1, AMOUNT);

      expect(await orderBook.getOrderRemainingAmount(1)).to.equal(0);
    });

    it("取消订单后应该返回零剩余数量", async function () {
      await orderBook.connect(seller).cancelOrder(1);

      expect(await orderBook.getOrderRemainingAmount(1)).to.equal(0);
    });

    it("不存在的订单应该返回零剩余数量", async function () {
      expect(await orderBook.getOrderRemainingAmount(999)).to.equal(0);
    });
  });

  describe("手续费管理", function () {
    it("应该成功更新手续费率", async function () {
      const newFeeRate = 50; // 0.5%
      
      const tx = await orderBook.setFeeRate(newFeeRate);

      await expect(tx)
        .to.emit(orderBook, "FeeRateUpdated")
        .withArgs(FEE_RATE, newFeeRate);

      expect(await orderBook.feeRate()).to.equal(newFeeRate);
    });

    it("应该成功更新手续费收集地址", async function () {
      const newCollector = buyer1.address;
      
      const tx = await orderBook.setFeeCollector(newCollector);

      await expect(tx)
        .to.emit(orderBook, "FeeCollectorUpdated")
        .withArgs(feeCollector.address, newCollector);

      expect(await orderBook.feeCollector()).to.equal(newCollector);
    });

    it("不应该接受超过 10% 的手续费率", async function () {
      await expect(
        orderBook.setFeeRate(1001)
      ).to.be.revertedWith("Fee rate too high");
    });

    it("应该接受 0% 的手续费率", async function () {
      await orderBook.setFeeRate(0);
      expect(await orderBook.feeRate()).to.equal(0);
    });

    it("应该接受最大 10% 的手续费率", async function () {
      await orderBook.setFeeRate(1000);
      expect(await orderBook.feeRate()).to.equal(1000);
    });

    it("不应该接受零地址作为手续费收集地址", async function () {
      await expect(
        orderBook.setFeeCollector(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee collector");
    });
  });

  describe("复杂场景测试", function () {
    it("应该正确处理多个买家成交同一订单", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const fill1 = AMOUNT / 4n;
      const fill2 = AMOUNT / 4n;
      const fill3 = AMOUNT / 2n;

      await orderBook.connect(buyer1).fillOrder(1, fill1);
      await orderBook.connect(buyer2).fillOrder(1, fill2);
      await orderBook.connect(buyer1).fillOrder(1, fill3);

      const order = await orderBook.getOrder(1);
      expect(order.filledAmount).to.equal(AMOUNT);
      expect(order.status).to.equal(1); // Filled
      expect(await orderBook.getOrderRemainingAmount(1)).to.equal(0);
    });

    it("应该正确处理同一用户的多个订单", async function () {
      // 创建3个订单
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(seller).createSellOrder(
        AMOUNT * 2n,
        PRICE * 2n,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(seller).createSellOrder(
        AMOUNT / 2n,
        PRICE / 2n,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      // 部分成交第一个
      await orderBook.connect(buyer1).fillOrder(1, AMOUNT / 2n);

      // 完全成交第二个
      await orderBook.connect(buyer1).fillOrder(2, AMOUNT * 2n);

      // 取消第三个
      await orderBook.connect(seller).cancelOrder(3);

      // 验证状态
      const order1 = await orderBook.getOrder(1);
      expect(order1.status).to.equal(0); // Active
      expect(order1.filledAmount).to.equal(AMOUNT / 2n);

      const order2 = await orderBook.getOrder(2);
      expect(order2.status).to.equal(1); // Filled

      const order3 = await orderBook.getOrder(3);
      expect(order3.status).to.equal(2); // Cancelled

      // 验证用户订单列表
      const userOrders = await orderBook.getUserOrders(seller.address);
      expect(userOrders.length).to.equal(3);
    });

    it("应该正确处理时间序列的订单", async function () {
      const startTime = await time.latest();

      // 创建订单1
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await time.increase(DAY);

      // 创建订单2
      await orderBook.connect(seller).createSellOrder(
        AMOUNT * 2n,
        PRICE,
        LAST_DIVIDEND_TIME + DAY,
        LAST_LIQUIDATION_CLAIM_TIME + DAY
      );

      await time.increase(DAY);

      // 创建订单3
      await orderBook.connect(seller).createSellOrder(
        AMOUNT / 2n,
        PRICE,
        LAST_DIVIDEND_TIME + DAY * 2,
        LAST_LIQUIDATION_CLAIM_TIME + DAY * 2
      );

      // 验证时间戳递增
      const order1 = await orderBook.getOrder(1);
      const order2 = await orderBook.getOrder(2);
      const order3 = await orderBook.getOrder(3);

      expect(order2.createdAt).to.be.gt(order1.createdAt);
      expect(order3.createdAt).to.be.gt(order2.createdAt);

      // 验证 lastDividendTime 正确保存
      expect(order1.lastDividendTime).to.equal(LAST_DIVIDEND_TIME);
      expect(order2.lastDividendTime).to.equal(LAST_DIVIDEND_TIME + DAY);
      expect(order3.lastDividendTime).to.equal(LAST_DIVIDEND_TIME + DAY * 2);
    });

    it("应该支持高频交易场景", async function () {
      const orderCount = 10;
      const fillCount = 5;

      // 创建多个订单
      for (let i = 0; i < orderCount; i++) {
        await orderBook.connect(seller).createSellOrder(
          AMOUNT,
          PRICE + BigInt(i),
          LAST_DIVIDEND_TIME,
          LAST_LIQUIDATION_CLAIM_TIME
        );
      }

      // 部分成交多个订单
      for (let i = 1; i <= fillCount; i++) {
        await orderBook.connect(buyer1).fillOrder(i, AMOUNT / 2n);
      }

      // 验证订单状态
      for (let i = 1; i <= fillCount; i++) {
        const order = await orderBook.getOrder(i);
        expect(order.filledAmount).to.equal(AMOUNT / 2n);
        expect(order.status).to.equal(0); // Active
      }

      expect(await orderBook.nextOrderId()).to.equal(orderCount + 1);
    });
  });

  describe("边界条件测试", function () {
    it("应该处理最小数量订单", async function () {
      const minAmount = 1n;
      
      await orderBook.connect(seller).createSellOrder(
        minAmount,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const order = await orderBook.getOrder(1);
      expect(order.amount).to.equal(minAmount);
    });

    it("应该处理最小价格订单", async function () {
      const minPrice = 1n;
      
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        minPrice,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const order = await orderBook.getOrder(1);
      expect(order.price).to.equal(minPrice);
    });

    it("应该处理大额订单", async function () {
      const largeAmount = ethers.parseUnits("1000000000", 18); // 10亿
      const largePrice = ethers.parseUnits("1000", 18);
      
      await orderBook.connect(seller).createSellOrder(
        largeAmount,
        largePrice,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const order = await orderBook.getOrder(1);
      expect(order.amount).to.equal(largeAmount);
      expect(order.price).to.equal(largePrice);
    });

    it("应该处理 lastDividendTime 为 0 的情况", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        0,
        0
      );

      const order = await orderBook.getOrder(1);
      expect(order.lastDividendTime).to.equal(0);
      expect(order.lastLiquidationClaimTime).to.equal(0);
    });

    it("应该处理很大的 lastDividendTime", async function () {
      const largeTime = ethers.MaxUint256 - 1n;
      
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        largeTime,
        largeTime
      );

      const order = await orderBook.getOrder(1);
      expect(order.lastDividendTime).to.equal(largeTime);
    });
  });

  describe("订单状态完整性测试", function () {
    it("新创建的订单状态应该为 Active", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(0); // OrderStatus.Active
    });

    it("完全成交的订单状态应该为 Filled", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(buyer1).fillOrder(1, AMOUNT);

      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(1); // OrderStatus.Filled
    });

    it("取消的订单状态应该为 Cancelled", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      await orderBook.connect(seller).cancelOrder(1);

      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(2); // OrderStatus.Cancelled
    });

    it("订单状态应该不可逆转", async function () {
      await orderBook.connect(seller).createSellOrder(
        AMOUNT,
        PRICE,
        LAST_DIVIDEND_TIME,
        LAST_LIQUIDATION_CLAIM_TIME
      );

      // 完全成交
      await orderBook.connect(buyer1).fillOrder(1, AMOUNT);

      // 不能再取消
      await expect(
        orderBook.connect(seller).cancelOrder(1)
      ).to.be.revertedWith("Order not active");

      // 不能再成交
      await expect(
        orderBook.connect(buyer1).fillOrder(1, 1)
      ).to.be.revertedWith("Order not active");
    });
  });
});

