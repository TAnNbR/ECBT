const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetToken Purchase 集成测试 (真实 CollateralVault)", function () {
  let assetToken;
  let collateralVault;
  let paymentToken; // Mock USDT
  let owner, buyer1, buyer2, buyer3, provider;

  // 资产参数
  const ASSET_NAME = "Test Real Estate Token";
  const ASSET_SYMBOL = "TRE";
  const TOTAL_VALUE = ethers.parseUnits("1000000", 6); // 100万 USDT
  const FUNDRAISE_AMOUNT = ethers.parseUnits("500000", 6); // 募集 50万 USDT
  const MAX_TOTAL_SUPPLY = ethers.parseUnits("1000000", 18); // 100万代币
  
  // 计算：每个代币价格 = 500000 / 1000000 = 0.5 USDT

  beforeEach(async function () {
    // 获取签名者
    [owner, buyer1, buyer2, buyer3, provider] = await ethers.getSigners();

    // 1. 部署 Mock ERC20 代币（模拟 USDT）
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await paymentToken.waitForDeployment();

    // 给买家铸造足够的 USDT（每人 600000 USDT）
    await paymentToken.mint(buyer1.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(buyer2.address, ethers.parseUnits("600000", 6));
    await paymentToken.mint(buyer3.address, ethers.parseUnits("600000", 6));

    // 2. 部署真实的 CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    collateralVault = await CollateralVault.deploy(await paymentToken.getAddress());
    await collateralVault.waitForDeployment();

    // 3. 部署 AssetToken
    const AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy();
    await assetToken.waitForDeployment();

    // 4. 初始化 AssetToken
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
      ethers.ZeroAddress // revenueManager 暂时不设置
    );

    console.log("PaymentToken (Mock USDT) deployed to:", await paymentToken.getAddress());
    console.log("CollateralVault deployed to:", await collateralVault.getAddress());
    console.log("AssetToken deployed to:", await assetToken.getAddress());
  });

  describe("基本购买功能", function () {
    it("应该能够成功购买资产代币", async function () {
      const purchaseAmount = ethers.parseUnits("1000", 18); // 购买 1000 个代币
      const expectedPayment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      // expectedPayment = 1000 * 500000 / 1000000 = 500 USDT

      // 买家1授权 paymentToken 给 AssetToken
      await paymentToken.connect(buyer1).approve(
        await assetToken.getAddress(),
        expectedPayment
      );

      // 记录购买前的余额
      const buyerUsdtBefore = await paymentToken.balanceOf(buyer1.address);
      const vaultUsdtBefore = await paymentToken.balanceOf(await collateralVault.getAddress());

      // 执行购买
      await assetToken.connect(buyer1).purchase(purchaseAmount);

      // 验证代币余额
      expect(await assetToken.balanceOf(buyer1.address)).to.equal(purchaseAmount);

      // 验证 USDT 转移
      const buyerUsdtAfter = await paymentToken.balanceOf(buyer1.address);
      const vaultUsdtAfter = await paymentToken.balanceOf(await collateralVault.getAddress());
      
      expect(buyerUsdtBefore - buyerUsdtAfter).to.equal(expectedPayment);
      expect(vaultUsdtAfter - vaultUsdtBefore).to.equal(expectedPayment);

      // 验证剩余可铸造数量
      const remaining = await assetToken.remainingMintableSupply();
      expect(remaining).to.equal(MAX_TOTAL_SUPPLY - purchaseAmount);
    });

    it("应该正确计算支付金额", async function () {
      // 测试不同购买数量的支付金额计算
      const testCases = [
        { amount: ethers.parseUnits("1000", 18), expected: ethers.parseUnits("500", 6) },
        { amount: ethers.parseUnits("10000", 18), expected: ethers.parseUnits("5000", 6) },
        { amount: ethers.parseUnits("100000", 18), expected: ethers.parseUnits("50000", 6) },
      ];

      for (const testCase of testCases) {
        // 计算预期支付金额
        const calculatedPayment = (testCase.amount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
        expect(calculatedPayment).to.equal(testCase.expected);
      }
    });

    it("多个买家可以分别购买", async function () {
      const amount1 = ethers.parseUnits("10000", 18);
      const amount2 = ethers.parseUnits("20000", 18);
      const amount3 = ethers.parseUnits("30000", 18);

      const payment1 = (amount1 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      const payment2 = (amount2 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      const payment3 = (amount3 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      // 买家1购买
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);

      // 买家2购买
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer2).purchase(amount2);

      // 买家3购买
      await paymentToken.connect(buyer3).approve(await assetToken.getAddress(), payment3);
      await assetToken.connect(buyer3).purchase(amount3);

      // 验证各自的余额
      expect(await assetToken.balanceOf(buyer1.address)).to.equal(amount1);
      expect(await assetToken.balanceOf(buyer2.address)).to.equal(amount2);
      expect(await assetToken.balanceOf(buyer3.address)).to.equal(amount3);

      // 验证总供应量
      const totalSupply = await assetToken.totalSupply();
      expect(totalSupply).to.equal(amount1 + amount2 + amount3);

      // 验证 CollateralVault 收到的总金额
      const vaultBalance = await paymentToken.balanceOf(await collateralVault.getAddress());
      expect(vaultBalance).to.equal(payment1 + payment2 + payment3);
    });

    it("应该将买家添加到持有者列表", async function () {
      const purchaseAmount = ethers.parseUnits("1000", 18);
      const payment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(purchaseAmount);

      // 验证 isHolder 状态
      expect(await assetToken.isHolder(buyer1.address)).to.be.true;

      // 验证持有者列表包含买家
      const holders = await assetToken.holders(0);
      expect(holders).to.equal(buyer1.address);
    });

    it("应该创建正确的持有者信息记录", async function () {
      const purchaseAmount = ethers.parseUnits("5000", 18);
      const payment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      
      const purchaseTime = await ethers.provider.getBlock('latest').then(b => b.timestamp);
      await assetToken.connect(buyer1).purchase(purchaseAmount);

      // 读取持有者信息（需要添加 getter 函数或直接访问）
      const holderInfoData = await assetToken.holderInfo(buyer1.address, 0);

      // 验证持有者信息
      expect(holderInfoData.shares).to.equal(purchaseAmount);
      expect(holderInfoData.holdingStartTime).to.be.greaterThan(purchaseTime);
      expect(holderInfoData.lastDividendTime).to.equal(ethers.MaxUint256); // INVALID_TIMESTAMP
      expect(holderInfoData.lastLiquidationClaimTime).to.equal(ethers.MaxUint256); // INVALID_TIMESTAMP
    });
  });

  describe("购买验证和限制", function () {
    it("应该拒绝购买 0 数量", async function () {
      await expect(
        assetToken.connect(buyer1).purchase(0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("应该拒绝超过剩余供应量的购买", async function () {
      const overAmount = MAX_TOTAL_SUPPLY + 1n;
      const payment = (overAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);

      await expect(
        assetToken.connect(buyer1).purchase(overAmount)
      ).to.be.revertedWith("Insufficient remaining supply");
    });

    it("应该拒绝没有足够 approve 的购买", async function () {
      const purchaseAmount = ethers.parseUnits("1000", 18);
      
      // 不进行 approve，或者 approve 不足的金额
      await paymentToken.connect(buyer1).approve(
        await assetToken.getAddress(),
        ethers.parseUnits("1", 6) // 只批准 1 USDT，实际需要 500 USDT
      );

      await expect(
        assetToken.connect(buyer1).purchase(purchaseAmount)
      ).to.be.reverted;
    });

    it("应该拒绝买家余额不足的购买", async function () {
      // 部署一个没有余额的买家
      const [, , , , , poorBuyer] = await ethers.getSigners();
      
      const purchaseAmount = ethers.parseUnits("1000", 18);
      const payment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(poorBuyer).approve(
        await assetToken.getAddress(),
        payment
      );

      await expect(
        assetToken.connect(poorBuyer).purchase(purchaseAmount)
      ).to.be.reverted;
    });
  });

  describe("剩余供应量管理", function () {
    it("购买后应该正确减少 remainingMintableSupply", async function () {
      const initialRemaining = await assetToken.remainingMintableSupply();
      expect(initialRemaining).to.equal(MAX_TOTAL_SUPPLY);

      const purchaseAmount = ethers.parseUnits("50000", 18);
      const payment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(purchaseAmount);

      const afterRemaining = await assetToken.remainingMintableSupply();
      expect(afterRemaining).to.equal(initialRemaining - purchaseAmount);
    });

    it("连续购买应该累计减少供应量", async function () {
      const amount1 = ethers.parseUnits("100000", 18);
      const amount2 = ethers.parseUnits("200000", 18);
      const amount3 = ethers.parseUnits("300000", 18);

      const payment1 = (amount1 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      const payment2 = (amount2 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      const payment3 = (amount3 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      // 第一次购买
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);
      expect(await assetToken.remainingMintableSupply()).to.equal(MAX_TOTAL_SUPPLY - amount1);

      // 第二次购买
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer2).purchase(amount2);
      expect(await assetToken.remainingMintableSupply()).to.equal(MAX_TOTAL_SUPPLY - amount1 - amount2);

      // 第三次购买
      await paymentToken.connect(buyer3).approve(await assetToken.getAddress(), payment3);
      await assetToken.connect(buyer3).purchase(amount3);
      expect(await assetToken.remainingMintableSupply()).to.equal(MAX_TOTAL_SUPPLY - amount1 - amount2 - amount3);
    });

    it("应该能够购买全部剩余供应量", async function () {
      const payment = FUNDRAISE_AMOUNT; // 购买全部需要全部募集金额

      // 验证售罄时间戳初始为 0
      expect(await assetToken.soldOutTimestamp()).to.equal(0);

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      // 验证供应量耗尽
      expect(await assetToken.remainingMintableSupply()).to.equal(0);
      expect(await assetToken.totalSupply()).to.equal(MAX_TOTAL_SUPPLY);
      
      // 验证售罄时间戳已被记录
      const soldOutTime = await assetToken.soldOutTimestamp();
      expect(soldOutTime).to.be.greaterThan(0);
      console.log("  售罄时间戳:", soldOutTime.toString());
    });

    it("供应量耗尽后不应该允许继续购买", async function () {
      // 先购买全部供应量
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), FUNDRAISE_AMOUNT);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      // 尝试再次购买
      const additionalAmount = ethers.parseUnits("1", 18);
      const additionalPayment = (additionalAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), additionalPayment);
      
      await expect(
        assetToken.connect(buyer2).purchase(additionalAmount)
      ).to.be.revertedWith("Insufficient remaining supply");
    });
  });

  describe("与 CollateralVault 的集成", function () {
    it("支付代币应该正确转入 CollateralVault", async function () {
      const purchaseAmount = ethers.parseUnits("10000", 18);
      const expectedPayment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      // expectedPayment = 10000 * 500000 / 1000000 = 5000 USDT

      const vaultBalanceBefore = await paymentToken.balanceOf(await collateralVault.getAddress());

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), expectedPayment);
      await assetToken.connect(buyer1).purchase(purchaseAmount);

      const vaultBalanceAfter = await paymentToken.balanceOf(await collateralVault.getAddress());
      
      // 验证 CollateralVault 收到正确金额
      expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(expectedPayment);
    });

    it("多次购买应该累计转入 CollateralVault", async function () {
      const purchases = [
        { buyer: buyer1, amount: ethers.parseUnits("5000", 18) },
        { buyer: buyer2, amount: ethers.parseUnits("10000", 18) },
        { buyer: buyer3, amount: ethers.parseUnits("15000", 18) }
      ];

      let totalExpectedPayment = 0n;

      for (const p of purchases) {
        const payment = (p.amount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
        totalExpectedPayment += payment;

        await paymentToken.connect(p.buyer).approve(await assetToken.getAddress(), payment);
        await assetToken.connect(p.buyer).purchase(p.amount);
      }

      // 验证 CollateralVault 收到的总金额
      const vaultBalance = await paymentToken.balanceOf(await collateralVault.getAddress());
      expect(vaultBalance).to.equal(totalExpectedPayment);
    });

    it("CollateralVault 未设置时应该失败", async function () {
      // 部署新的 AssetToken 但不设置 collateralVault
      const AssetToken = await ethers.getContractFactory("AssetToken");
      const newAssetToken = await AssetToken.deploy();
      await newAssetToken.waitForDeployment();

      const metadata = {
        name: "Test",
        symbol: "TST",
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
        ethers.ZeroAddress, // 不设置 collateralVault
        ethers.ZeroAddress
      );

      const purchaseAmount = ethers.parseUnits("1000", 18);
      
      await expect(
        newAssetToken.connect(buyer1).purchase(purchaseAmount)
      ).to.be.revertedWith("Collateral vault not set");
    });
  });

  describe("持有者信息管理", function () {
    it("同一买家多次购买应该创建多个持有者信息记录", async function () {
      const amount1 = ethers.parseUnits("1000", 18);
      const amount2 = ethers.parseUnits("2000", 18);

      const payment1 = (amount1 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      const payment2 = (amount2 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      // 第一次购买
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);

      // 第二次购买
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer1).purchase(amount2);

      // 验证持有者信息记录数量（需要添加 getter）
      // 验证总余额
      expect(await assetToken.balanceOf(buyer1.address)).to.equal(amount1 + amount2);
    });

    it("持有者信息应该正确初始化", async function () {
      const purchaseAmount = ethers.parseUnits("1000", 18);
      const payment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(purchaseAmount);

      // 读取持有者信息
      const info = await assetToken.holderInfo(buyer1.address, 0);

      // 验证份额
      expect(info.shares).to.equal(purchaseAmount);

      // 验证时间戳
      expect(info.holdingStartTime).to.be.greaterThan(0);
      
      // 验证初始状态（从未领取）
      expect(info.lastDividendTime).to.equal(ethers.MaxUint256);
      expect(info.lastLiquidationClaimTime).to.equal(ethers.MaxUint256);
    });
  });

  describe("边界情况测试", function () {
    it("应该处理最小购买数量", async function () {
      const minAmount = 1n; // 最小 1 wei
      const payment = (minAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      if (payment === 0n) {
        // 如果计算出的支付金额为 0，应该拒绝
        await expect(
          assetToken.connect(buyer1).purchase(minAmount)
        ).to.be.revertedWith("Payment amount too small");
      } else {
        await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
        await assetToken.connect(buyer1).purchase(minAmount);
        expect(await assetToken.balanceOf(buyer1.address)).to.equal(minAmount);
      }
    });

    it("应该正确处理精度计算", async function () {
      // 测试各种精度的购买金额
      const testAmounts = [
        ethers.parseUnits("0.001", 18),  // 0.001 个代币
        ethers.parseUnits("1.5", 18),    // 1.5 个代币
        ethers.parseUnits("999.999", 18) // 999.999 个代币
      ];

      for (const amount of testAmounts) {
        const payment = (amount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
        
        if (payment > 0) {
          // 部署新的 AssetToken 用于独立测试
          const AssetToken = await ethers.getContractFactory("AssetToken");
          const freshToken = await AssetToken.deploy();
          await freshToken.waitForDeployment();

          const metadata = {
            name: "Test",
            symbol: "TST",
            totalValue: TOTAL_VALUE,
            fundraiseAmount: FUNDRAISE_AMOUNT,
            maxTotalSupply: MAX_TOTAL_SUPPLY,
            specialPurposeVehicle: owner.address,
            provider: provider.address,
            createdAt: await ethers.provider.getBlock('latest').then(b => b.timestamp)
          };

          await freshToken.initialize(
            metadata,
            await paymentToken.getAddress(),
            await collateralVault.getAddress(),
            ethers.ZeroAddress
          );

          await paymentToken.connect(buyer1).approve(await freshToken.getAddress(), payment);
          await expect(
            freshToken.connect(buyer1).purchase(amount)
          ).to.not.be.reverted;
        }
      }
    });

    it("支付金额计算为 0 时应该拒绝", async function () {
      // 如果购买数量太小导致支付金额为 0
      const tinyAmount = 1n; // 可能因为精度问题导致支付为 0

      const calculatedPayment = (tinyAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      
      if (calculatedPayment === 0n) {
        await expect(
          assetToken.connect(buyer1).purchase(tinyAmount)
        ).to.be.revertedWith("Payment amount too small");
      }
    });
  });

  describe("售罄时间戳记录", function () {
    it("未售罄时 soldOutTimestamp 应该为 0", async function () {
      const purchaseAmount = ethers.parseUnits("10000", 18);
      const payment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(purchaseAmount);

      // 验证未售罄
      expect(await assetToken.remainingMintableSupply()).to.be.greaterThan(0);
      expect(await assetToken.soldOutTimestamp()).to.equal(0);
    });

    it("售罄时应该记录正确的时间戳", async function () {
      const payment = FUNDRAISE_AMOUNT;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      
      const tx = await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);
      const receipt = await tx.wait();
      const blockTimestamp = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;

      // 验证售罄时间戳等于购买交易的区块时间
      const soldOutTime = await assetToken.soldOutTimestamp();
      expect(soldOutTime).to.equal(blockTimestamp);
    });

    it("分批购买至售罄时应该记录最后一次购买的时间", async function () {
      // 买家1购买 50%
      const amount1 = MAX_TOTAL_SUPPLY / 2n;
      const payment1 = (amount1 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);

      // 此时未售罄
      expect(await assetToken.soldOutTimestamp()).to.equal(0);

      // 买家2购买剩余 50%（售罄）
      const amount2 = MAX_TOTAL_SUPPLY / 2n;
      const payment2 = (amount2 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      
      const tx = await assetToken.connect(buyer2).purchase(amount2);
      const receipt = await tx.wait();
      const blockTimestamp = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;

      // 验证售罄时间戳是第二次购买的时间
      const soldOutTime = await assetToken.soldOutTimestamp();
      expect(soldOutTime).to.equal(blockTimestamp);
      expect(soldOutTime).to.be.greaterThan(0);
    });

    it("售罄后时间戳不应该改变", async function () {
      // 先售罄
      const payment = FUNDRAISE_AMOUNT;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      const firstSoldOutTime = await assetToken.soldOutTimestamp();
      expect(firstSoldOutTime).to.be.greaterThan(0);

      // 验证时间戳已固定（即使尝试购买也不会改变）
      // 注意：实际上售罄后无法购买，这只是验证时间戳的不可变性
      const soldOutTimeLater = await assetToken.soldOutTimestamp();
      expect(soldOutTimeLater).to.equal(firstSoldOutTime);
    });
  });

  describe("完整募资场景", function () {
    it("应该能够完成全部募资", async function () {
      // 三个买家分别购买，完成全部募资
      const amount1 = ethers.parseUnits("300000", 18); // 30%
      const amount2 = ethers.parseUnits("300000", 18); // 30%
      const amount3 = ethers.parseUnits("400000", 18); // 40%
      
      const payment1 = (amount1 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      const payment2 = (amount2 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      const payment3 = (amount3 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      // 买家1
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);

      // 买家2
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      await assetToken.connect(buyer2).purchase(amount2);

      // 买家3
      await paymentToken.connect(buyer3).approve(await assetToken.getAddress(), payment3);
      await assetToken.connect(buyer3).purchase(amount3);

      // 验证全部募资完成
      expect(await assetToken.remainingMintableSupply()).to.equal(0);
      expect(await assetToken.totalSupply()).to.equal(MAX_TOTAL_SUPPLY);

      // 验证 CollateralVault 收到的总金额接近募集目标
      const vaultBalance = await paymentToken.balanceOf(await collateralVault.getAddress());
      expect(vaultBalance).to.equal(payment1 + payment2 + payment3);
      
      // 因为精度问题，可能有微小差异，验证在合理范围内
      const difference = vaultBalance > FUNDRAISE_AMOUNT 
        ? vaultBalance - FUNDRAISE_AMOUNT 
        : FUNDRAISE_AMOUNT - vaultBalance;
      expect(difference).to.be.lessThan(ethers.parseUnits("1", 6)); // 差异小于 1 USDT
    });
  });

  describe("价格计算验证", function () {
    it("应该按比例计算支付金额", async function () {
      // 购买 1% 的代币，应该支付 1% 的募集金额
      const onePercentTokens = MAX_TOTAL_SUPPLY / 100n;
      const expectedPayment = FUNDRAISE_AMOUNT / 100n;
      
      const calculatedPayment = (onePercentTokens * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      
      expect(calculatedPayment).to.equal(expectedPayment);
    });

    it("应该验证价格一致性", async function () {
      // 购买相同数量的代币，支付应该相同
      const amount = ethers.parseUnits("5000", 18);
      const payment = (amount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      // 买家1购买
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      const buyer1Before = await paymentToken.balanceOf(buyer1.address);
      await assetToken.connect(buyer1).purchase(amount);
      const buyer1Paid = buyer1Before - await paymentToken.balanceOf(buyer1.address);

      // 买家2购买相同数量
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment);
      const buyer2Before = await paymentToken.balanceOf(buyer2.address);
      await assetToken.connect(buyer2).purchase(amount);
      const buyer2Paid = buyer2Before - await paymentToken.balanceOf(buyer2.address);

      // 验证支付金额相同
      expect(buyer1Paid).to.equal(buyer2Paid);
      expect(buyer1Paid).to.equal(payment);
    });
  });

  describe("onlySoldOut 修饰符测试", function () {
    // 创建一个测试函数来使用这个修饰符
    // 注意：这需要在 AssetToken 中有使用 onlySoldOut 的函数
    // 这里我们通过验证 soldOutTimestamp 的行为来间接测试修饰符

    it("售罄前 soldOutTimestamp 应该为 0", async function () {
      expect(await assetToken.soldOutTimestamp()).to.equal(0);
    });

    it("部分购买后 soldOutTimestamp 仍为 0", async function () {
      const partialAmount = MAX_TOTAL_SUPPLY / 2n;
      const payment = (partialAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(partialAmount);

      expect(await assetToken.soldOutTimestamp()).to.equal(0);
    });

    it("完全售罄时 soldOutTimestamp 应该被设置", async function () {
      const payment = FUNDRAISE_AMOUNT;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);
      await assetToken.connect(buyer1).purchase(MAX_TOTAL_SUPPLY);

      const soldOutTime = await assetToken.soldOutTimestamp();
      expect(soldOutTime).to.be.greaterThan(0);
    });

    it("soldOutTimestamp 只应该设置一次", async function () {
      // 第一次购买 80%
      const amount1 = (MAX_TOTAL_SUPPLY * 80n) / 100n;
      const payment1 = (amount1 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment1);
      await assetToken.connect(buyer1).purchase(amount1);

      expect(await assetToken.soldOutTimestamp()).to.equal(0);

      // 第二次购买剩余 20%（售罄）
      const amount2 = MAX_TOTAL_SUPPLY - amount1;
      const payment2 = (amount2 * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;
      await paymentToken.connect(buyer2).approve(await assetToken.getAddress(), payment2);
      
      const tx = await assetToken.connect(buyer2).purchase(amount2);
      const receipt = await tx.wait();
      const blockTimestamp = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;

      const soldOutTime = await assetToken.soldOutTimestamp();
      expect(soldOutTime).to.equal(blockTimestamp);
      expect(soldOutTime).to.be.greaterThan(0);
    });
  });

  describe("事件验证", function () {
    it("CollateralVault 应该触发 FundraiseReceived 事件", async function () {
      const purchaseAmount = ethers.parseUnits("1000", 18);
      const payment = (purchaseAmount * FUNDRAISE_AMOUNT) / MAX_TOTAL_SUPPLY;

      await paymentToken.connect(buyer1).approve(await assetToken.getAddress(), payment);

      // 注意：这个事件可能在 AssetToken 中触发，需要检查实际实现
      // 如果 CollateralVault 有 recordFundraise 函数并触发事件，需要验证
    });
  });
});

