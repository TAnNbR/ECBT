const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CollateralVault 合约测试", function () {
  let collateralVault;
  let paymentToken;
  let owner, provider, buyer1, buyer2, recipient;

  // 测试参数
  const INITIAL_SUPPLY = ethers.parseUnits("10000000", 6); // 1000万 USDT
  const FUNDRAISE_AMOUNT = ethers.parseUnits("100000", 6); // 10万 USDT
  const COLLATERAL_AMOUNT = ethers.parseUnits("50000", 6); // 5万 USDT
  const REVENUE_AMOUNT = ethers.parseUnits("10000", 6); // 1万 USDT
  const LIQUIDATION_PERCENTAGE = 2000; // 20%

  beforeEach(async function () {
    [owner, provider, buyer1, buyer2, recipient] = await ethers.getSigners();

    // 部署 MockERC20 作为抵押代币
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 6);
    await paymentToken.waitForDeployment();

    // 部署 CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    collateralVault = await CollateralVault.deploy(await paymentToken.getAddress());
    await collateralVault.waitForDeployment();

    // 为测试账户铸造代币
    await paymentToken.mint(owner.address, INITIAL_SUPPLY);
    await paymentToken.mint(provider.address, INITIAL_SUPPLY);
    await paymentToken.mint(buyer1.address, INITIAL_SUPPLY);

    console.log("CollateralVault deployed to:", await collateralVault.getAddress());
    console.log("PaymentToken deployed to:", await paymentToken.getAddress());
  });

  describe("部署和初始化", function () {
    it("应该正确设置抵押代币地址", async function () {
      expect(await collateralVault.collateralToken()).to.equal(await paymentToken.getAddress());
    });

    it("应该初始化所有金额为 0", async function () {
      expect(await collateralVault.totalFundraisedAmount()).to.equal(0);
      expect(await collateralVault.totalWithdrawnFundraise()).to.equal(0);
      expect(await collateralVault.currentRevenue()).to.equal(0);
      expect(await collateralVault.distributedRevenue()).to.equal(0);
      expect(await collateralVault.depositedRevenue()).to.equal(0);
      expect(await collateralVault.totalCollateralAmount()).to.equal(0);
      expect(await collateralVault.liquidatableCollateralAmount()).to.equal(0);
    });

    it("应该正确设置清算百分比常量", async function () {
      expect(await collateralVault.LIQUIDATION_PERCENTAGE()).to.equal(LIQUIDATION_PERCENTAGE);
    });

    it("不应该接受零地址作为抵押代币", async function () {
      const CollateralVault = await ethers.getContractFactory("CollateralVault");
      await expect(
        CollateralVault.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid collateral token");
    });
  });

  describe("募集资金管理", function () {
    describe("记录募集资金", function () {
      it("应该成功记录募集资金", async function () {
        const tx = await collateralVault.recordFundraise(buyer1.address, FUNDRAISE_AMOUNT);

        // 检查事件
        await expect(tx)
          .to.emit(collateralVault, "FundraiseReceived")
          .withArgs(buyer1.address, FUNDRAISE_AMOUNT, FUNDRAISE_AMOUNT);

        // 检查状态
        expect(await collateralVault.totalFundraisedAmount()).to.equal(FUNDRAISE_AMOUNT);
      });

      it("应该累计多次募集资金", async function () {
        await collateralVault.recordFundraise(buyer1.address, FUNDRAISE_AMOUNT);
        await collateralVault.recordFundraise(buyer2.address, FUNDRAISE_AMOUNT);

        expect(await collateralVault.totalFundraisedAmount()).to.equal(FUNDRAISE_AMOUNT * 2n);
      });

      it("不应该接受零地址作为购买者", async function () {
        await expect(
          collateralVault.recordFundraise(ethers.ZeroAddress, FUNDRAISE_AMOUNT)
        ).to.be.revertedWith("Invalid buyer");
      });

      it("不应该接受零金额", async function () {
        await expect(
          collateralVault.recordFundraise(buyer1.address, 0)
        ).to.be.revertedWith("Amount must be positive");
      });
    });

    describe("提取募集资金", function () {
      beforeEach(async function () {
        // 先记录募集资金
        await collateralVault.recordFundraise(buyer1.address, FUNDRAISE_AMOUNT);
        
        // 将代币转入 vault（模拟实际购买）
        await paymentToken.transfer(await collateralVault.getAddress(), FUNDRAISE_AMOUNT);
      });

      it("应该成功提取募集资金", async function () {
        const beforeBalance = await paymentToken.balanceOf(recipient.address);

        const tx = await collateralVault.withdrawFundraise(recipient.address, FUNDRAISE_AMOUNT / 2n);

        // 检查事件
        await expect(tx)
          .to.emit(collateralVault, "FundraiseWithdrawn")
          .withArgs(recipient.address, FUNDRAISE_AMOUNT / 2n, FUNDRAISE_AMOUNT / 2n);

        // 检查余额
        const afterBalance = await paymentToken.balanceOf(recipient.address);
        expect(afterBalance - beforeBalance).to.equal(FUNDRAISE_AMOUNT / 2n);

        // 检查状态
        expect(await collateralVault.totalWithdrawnFundraise()).to.equal(FUNDRAISE_AMOUNT / 2n);
      });

      it("应该支持多次提取", async function () {
        const firstWithdraw = FUNDRAISE_AMOUNT / 3n;
        const secondWithdraw = FUNDRAISE_AMOUNT / 3n;

        await collateralVault.withdrawFundraise(recipient.address, firstWithdraw);
        await collateralVault.withdrawFundraise(recipient.address, secondWithdraw);

        expect(await collateralVault.totalWithdrawnFundraise()).to.equal(firstWithdraw + secondWithdraw);
      });

      it("不应该提取超过可用金额", async function () {
        await expect(
          collateralVault.withdrawFundraise(recipient.address, FUNDRAISE_AMOUNT + 1n)
        ).to.be.revertedWith("Insufficient fundraised amount");
      });

      it("不应该接受零地址作为接收者", async function () {
        await expect(
          collateralVault.withdrawFundraise(ethers.ZeroAddress, FUNDRAISE_AMOUNT)
        ).to.be.revertedWith("Invalid recipient");
      });

      it("不应该接受零金额", async function () {
        await expect(
          collateralVault.withdrawFundraise(recipient.address, 0)
        ).to.be.revertedWith("Amount must be positive");
      });

      it("提取后剩余金额应该正确", async function () {
        await collateralVault.withdrawFundraise(recipient.address, FUNDRAISE_AMOUNT / 4n);

        const remaining = await collateralVault.totalFundraisedAmount() - 
                         await collateralVault.totalWithdrawnFundraise();
        expect(remaining).to.equal(FUNDRAISE_AMOUNT * 3n / 4n);
      });
    });
  });

  describe("抵押金管理", function () {
    it("应该成功存入押金", async function () {
      // 授权
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        COLLATERAL_AMOUNT
      );

      const beforeBalance = await paymentToken.balanceOf(provider.address);

      const tx = await collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT);

      // 检查事件
      await expect(tx)
        .to.emit(collateralVault, "CollateralDepositedByProvider")
        .withArgs(provider.address, COLLATERAL_AMOUNT);

      // 检查余额
      const afterBalance = await paymentToken.balanceOf(provider.address);
      expect(beforeBalance - afterBalance).to.equal(COLLATERAL_AMOUNT);

      // 检查状态
      expect(await collateralVault.totalCollateralAmount()).to.equal(COLLATERAL_AMOUNT);
    });

    it("应该累计多次存入", async function () {
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        COLLATERAL_AMOUNT * 2n
      );

      await collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT);
      await collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT);

      expect(await collateralVault.totalCollateralAmount()).to.equal(COLLATERAL_AMOUNT * 2n);
    });

    it("不应该接受零金额", async function () {
      await expect(
        collateralVault.connect(provider).depositCollateralByProvider(0)
      ).to.be.revertedWith("Amount must be positive");
    });

    it("没有授权应该失败", async function () {
      await expect(
        collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT)
      ).to.be.reverted;
    });

    it("余额不足应该失败", async function () {
      const largeAmount = INITIAL_SUPPLY + 1n;
      
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        largeAmount
      );

      await expect(
        collateralVault.connect(provider).depositCollateralByProvider(largeAmount)
      ).to.be.reverted;
    });
  });

  describe("收益管理", function () {
    describe("更新当前收益", function () {
      it("应该成功更新当前收益", async function () {
        const tx = await collateralVault.updateCurrentRevenue(REVENUE_AMOUNT);

        // 检查事件
        await expect(tx)
          .to.emit(collateralVault, "CurrentRevenueUpdated")
          .withArgs(REVENUE_AMOUNT, 0);

        // 检查状态
        expect(await collateralVault.currentRevenue()).to.equal(REVENUE_AMOUNT);
      });

      it("应该累计更新收益", async function () {
        await collateralVault.updateCurrentRevenue(REVENUE_AMOUNT);
        await collateralVault.updateCurrentRevenue(REVENUE_AMOUNT);

        expect(await collateralVault.currentRevenue()).to.equal(REVENUE_AMOUNT * 2n);
      });

      it("应该接受零增量", async function () {
        await collateralVault.updateCurrentRevenue(0);
        expect(await collateralVault.currentRevenue()).to.equal(0);
      });
    });

    describe("存入收益", function () {
      it("应该成功存入收益", async function () {
        // 授权
        await paymentToken.connect(provider).approve(
          await collateralVault.getAddress(),
          REVENUE_AMOUNT
        );

        const beforeBalance = await paymentToken.balanceOf(provider.address);

        const tx = await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);

        // 检查事件
        await expect(tx)
          .to.emit(collateralVault, "RevenueDeposited")
          .withArgs(provider.address, REVENUE_AMOUNT, REVENUE_AMOUNT);

        // 检查余额
        const afterBalance = await paymentToken.balanceOf(provider.address);
        expect(beforeBalance - afterBalance).to.equal(REVENUE_AMOUNT);

        // 检查状态
        expect(await collateralVault.depositedRevenue()).to.equal(REVENUE_AMOUNT);
      });

      it("应该累计多次存入", async function () {
        await paymentToken.connect(provider).approve(
          await collateralVault.getAddress(),
          REVENUE_AMOUNT * 2n
        );

        await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);
        await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);

        expect(await collateralVault.depositedRevenue()).to.equal(REVENUE_AMOUNT * 2n);
      });

      it("不应该接受零金额", async function () {
        await expect(
          collateralVault.connect(provider).depositRevenue(0)
        ).to.be.revertedWith("Amount must be positive");
      });
    });

    describe("转出收益", function () {
      beforeEach(async function () {
        // 先存入收益
        await paymentToken.connect(provider).approve(
          await collateralVault.getAddress(),
          REVENUE_AMOUNT
        );
        await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);
      });

      it("应该成功转出收益", async function () {
        const transferAmount = REVENUE_AMOUNT / 2n;
        const beforeBalance = await paymentToken.balanceOf(recipient.address);

        const tx = await collateralVault.transferRevenue(recipient.address, transferAmount);

        // 检查事件
        await expect(tx)
          .to.emit(collateralVault, "RevenueTransferred")
          .withArgs(recipient.address, transferAmount, REVENUE_AMOUNT - transferAmount);

        // 检查余额
        const afterBalance = await paymentToken.balanceOf(recipient.address);
        expect(afterBalance - beforeBalance).to.equal(transferAmount);

        // 检查状态
        expect(await collateralVault.distributedRevenue()).to.equal(transferAmount);
      });

      it("应该支持多次转出", async function () {
        const firstTransfer = REVENUE_AMOUNT / 3n;
        const secondTransfer = REVENUE_AMOUNT / 3n;

        await collateralVault.transferRevenue(recipient.address, firstTransfer);
        await collateralVault.transferRevenue(recipient.address, secondTransfer);

        expect(await collateralVault.distributedRevenue()).to.equal(firstTransfer + secondTransfer);
      });

      it("不应该转出超过可用金额", async function () {
        await expect(
          collateralVault.transferRevenue(recipient.address, REVENUE_AMOUNT + 1n)
        ).to.be.revertedWith("Insufficient available revenue");
      });

      it("不应该接受零地址作为接收者", async function () {
        await expect(
          collateralVault.transferRevenue(ethers.ZeroAddress, REVENUE_AMOUNT)
        ).to.be.revertedWith("Invalid recipient");
      });

      it("不应该接受零金额", async function () {
        await expect(
          collateralVault.transferRevenue(recipient.address, 0)
        ).to.be.revertedWith("Amount must be positive");
      });

      it("部分转出后应该正确计算剩余", async function () {
        await collateralVault.transferRevenue(recipient.address, REVENUE_AMOUNT / 4n);

        const available = await collateralVault.getAvailableRevenue();
        expect(available).to.equal(REVENUE_AMOUNT * 3n / 4n);
      });
    });

    describe("获取可用收益", function () {
      it("初始可用收益应该为 0", async function () {
        expect(await collateralVault.getAvailableRevenue()).to.equal(0);
      });

      it("存入后可用收益应该增加", async function () {
        await paymentToken.connect(provider).approve(
          await collateralVault.getAddress(),
          REVENUE_AMOUNT
        );
        await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);

        expect(await collateralVault.getAvailableRevenue()).to.equal(REVENUE_AMOUNT);
      });

      it("转出后可用收益应该减少", async function () {
        await paymentToken.connect(provider).approve(
          await collateralVault.getAddress(),
          REVENUE_AMOUNT
        );
        await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);
        await collateralVault.transferRevenue(recipient.address, REVENUE_AMOUNT / 2n);

        expect(await collateralVault.getAvailableRevenue()).to.equal(REVENUE_AMOUNT / 2n);
      });
    });
  });

  describe("清算管理", function () {
    beforeEach(async function () {
      // 先存入押金
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        COLLATERAL_AMOUNT
      );
      await collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT);
    });

    describe("更新可清算押金", function () {
      it("应该成功更新可清算押金（使用默认 20%）", async function () {
        const expectedIncrease = (COLLATERAL_AMOUNT * LIQUIDATION_PERCENTAGE) / 10000n;

        const tx = await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);

        // 检查事件
        await expect(tx)
          .to.emit(collateralVault, "LiquidatableCollateralUpdated")
          .withArgs(expectedIncrease, expectedIncrease);

        // 检查状态
        expect(await collateralVault.liquidatableCollateralAmount()).to.equal(expectedIncrease);
      });

      it("应该支持不同的百分比", async function () {
        const customPercentage = 3000; // 30%
        const expectedIncrease = (COLLATERAL_AMOUNT * BigInt(customPercentage)) / 10000n;

        await collateralVault.updateLiquidatableCollateral(customPercentage);

        expect(await collateralVault.liquidatableCollateralAmount()).to.equal(expectedIncrease);
      });

      it("应该累计多次更新", async function () {
        await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);
        await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);

        const expectedTotal = (COLLATERAL_AMOUNT * LIQUIDATION_PERCENTAGE * 2n) / 10000n;
        expect(await collateralVault.liquidatableCollateralAmount()).to.equal(expectedTotal);
      });

      it("不应该接受零百分比", async function () {
        await expect(
          collateralVault.updateLiquidatableCollateral(0)
        ).to.be.revertedWith("Invalid percentage");
      });

      it("不应该接受超过 100% 的百分比", async function () {
        await expect(
          collateralVault.updateLiquidatableCollateral(10001)
        ).to.be.revertedWith("Invalid percentage");
      });

      it("应该接受最大 100% 的百分比", async function () {
        const expectedIncrease = COLLATERAL_AMOUNT; // 100%

        await collateralVault.updateLiquidatableCollateral(10000);

        expect(await collateralVault.liquidatableCollateralAmount()).to.equal(expectedIncrease);
      });
    });

    describe("转移清算金额", function () {
      beforeEach(async function () {
        // 先更新可清算金额
        await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);
      });

      it("应该成功转移清算金额", async function () {
        const shareBase = ethers.parseUnits("1000", 18); // 持有 1000 代币
        const totalShares = ethers.parseUnits("10000", 18); // 总共 10000 代币
        const liquidationCount = 1;

        // 计算预期金额
        const singleLiquidation = (COLLATERAL_AMOUNT * LIQUIDATION_PERCENTAGE) / 10000n;
        const expectedAmount = (shareBase * singleLiquidation * BigInt(liquidationCount)) / totalShares;

        const beforeBalance = await paymentToken.balanceOf(recipient.address);

        const tx = await collateralVault.transferLiquidatableCollateral(
          recipient.address,
          shareBase,
          totalShares,
          liquidationCount
        );

        // 检查事件
        await expect(tx)
          .to.emit(collateralVault, "LiquidatableCollateralTransferred");

        // 检查余额
        const afterBalance = await paymentToken.balanceOf(recipient.address);
        expect(afterBalance - beforeBalance).to.equal(expectedAmount);
      });

      it("应该正确处理多次清算", async function () {
        const shareBase = ethers.parseUnits("1000", 18);
        const totalShares = ethers.parseUnits("10000", 18);
        const liquidationCount = 3;

        const singleLiquidation = (COLLATERAL_AMOUNT * LIQUIDATION_PERCENTAGE) / 10000n;
        const expectedAmount = (shareBase * singleLiquidation * BigInt(liquidationCount)) / totalShares;

        // 先增加足够的可清算金额
        await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);
        await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);

        const beforeBalance = await paymentToken.balanceOf(recipient.address);

        await collateralVault.transferLiquidatableCollateral(
          recipient.address,
          shareBase,
          totalShares,
          liquidationCount
        );

        const afterBalance = await paymentToken.balanceOf(recipient.address);
        expect(afterBalance - beforeBalance).to.equal(expectedAmount);
      });

      it("应该正确处理不同的份额比例", async function () {
        const testCases = [
          { shareBase: ethers.parseUnits("1000", 18), percentage: "10%" },
          { shareBase: ethers.parseUnits("2500", 18), percentage: "25%" },
          { shareBase: ethers.parseUnits("5000", 18), percentage: "50%" },
          { shareBase: ethers.parseUnits("10000", 18), percentage: "100%" },
        ];

        const totalShares = ethers.parseUnits("10000", 18);
        const liquidationCount = 1;
        const singleLiquidation = (COLLATERAL_AMOUNT * LIQUIDATION_PERCENTAGE) / 10000n;

        for (const testCase of testCases) {
          // 重置状态
          await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);

          const expectedAmount = (testCase.shareBase * singleLiquidation * BigInt(liquidationCount)) / totalShares;
          const beforeBalance = await paymentToken.balanceOf(recipient.address);

          await collateralVault.transferLiquidatableCollateral(
            recipient.address,
            testCase.shareBase,
            totalShares,
            liquidationCount
          );

          const afterBalance = await paymentToken.balanceOf(recipient.address);
          const actualAmount = afterBalance - beforeBalance;
          
          expect(actualAmount).to.equal(expectedAmount);
          console.log(`  ${testCase.percentage}: ${ethers.formatUnits(actualAmount, 6)} USDT`);
        }
      });

      it("不应该接受零地址作为接收者", async function () {
        await expect(
          collateralVault.transferLiquidatableCollateral(
            ethers.ZeroAddress,
            ethers.parseUnits("1000", 18),
            ethers.parseUnits("10000", 18),
            1
          )
        ).to.be.revertedWith("Invalid recipient");
      });

      it("不应该接受零份额", async function () {
        await expect(
          collateralVault.transferLiquidatableCollateral(
            recipient.address,
            0,
            ethers.parseUnits("10000", 18),
            1
          )
        ).to.be.revertedWith("Share base must be positive");
      });

      it("不应该接受零总份额", async function () {
        await expect(
          collateralVault.transferLiquidatableCollateral(
            recipient.address,
            ethers.parseUnits("1000", 18),
            0,
            1
          )
        ).to.be.revertedWith("Total shares must be positive");
      });

      it("不应该接受零清算次数", async function () {
        await expect(
          collateralVault.transferLiquidatableCollateral(
            recipient.address,
            ethers.parseUnits("1000", 18),
            ethers.parseUnits("10000", 18),
            0
          )
        ).to.be.revertedWith("Liquidation count must be positive");
      });

      it("份额不应该超过总份额", async function () {
        await expect(
          collateralVault.transferLiquidatableCollateral(
            recipient.address,
            ethers.parseUnits("10001", 18),
            ethers.parseUnits("10000", 18),
            1
          )
        ).to.be.revertedWith("Share base exceeds total shares");
      });

      it("不应该转移超过可用金额", async function () {
        const shareBase = ethers.parseUnits("10000", 18);
        const totalShares = ethers.parseUnits("10000", 18);
        const liquidationCount = 10; // 过多的清算次数

        await expect(
          collateralVault.transferLiquidatableCollateral(
            recipient.address,
            shareBase,
            totalShares,
            liquidationCount
          )
        ).to.be.revertedWith("Insufficient liquidatable collateral");
      });
    });
  });

  describe("复杂场景测试", function () {
    it("应该正确处理完整的资金流", async function () {
      // 1. 记录募集资金
      await collateralVault.recordFundraise(buyer1.address, FUNDRAISE_AMOUNT);
      await paymentToken.transfer(await collateralVault.getAddress(), FUNDRAISE_AMOUNT);

      // 2. 提取部分募集资金
      await collateralVault.withdrawFundraise(recipient.address, FUNDRAISE_AMOUNT / 2n);

      // 3. 存入押金
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        COLLATERAL_AMOUNT
      );
      await collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT);

      // 4. 更新和存入收益
      await collateralVault.updateCurrentRevenue(REVENUE_AMOUNT);
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        REVENUE_AMOUNT
      );
      await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);

      // 5. 转出收益
      await collateralVault.transferRevenue(recipient.address, REVENUE_AMOUNT / 2n);

      // 6. 更新可清算金额
      await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);

      // 验证最终状态
      expect(await collateralVault.totalFundraisedAmount()).to.equal(FUNDRAISE_AMOUNT);
      expect(await collateralVault.totalWithdrawnFundraise()).to.equal(FUNDRAISE_AMOUNT / 2n);
      expect(await collateralVault.totalCollateralAmount()).to.equal(COLLATERAL_AMOUNT);
      expect(await collateralVault.currentRevenue()).to.equal(REVENUE_AMOUNT);
      expect(await collateralVault.distributedRevenue()).to.equal(REVENUE_AMOUNT / 2n);
      expect(await collateralVault.getAvailableRevenue()).to.equal(REVENUE_AMOUNT / 2n);
    });

    it("应该正确处理多个提供者的押金", async function () {
      const amount1 = ethers.parseUnits("30000", 6);
      const amount2 = ethers.parseUnits("20000", 6);

      // 提供者1存入
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        amount1
      );
      await collateralVault.connect(provider).depositCollateralByProvider(amount1);

      // 提供者2存入（使用 buyer1 模拟第二个提供者）
      await paymentToken.connect(buyer1).approve(
        await collateralVault.getAddress(),
        amount2
      );
      await collateralVault.connect(buyer1).depositCollateralByProvider(amount2);

      expect(await collateralVault.totalCollateralAmount()).to.equal(amount1 + amount2);
    });

    it("应该正确处理连续的清算周期", async function () {
      // 存入押金
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        COLLATERAL_AMOUNT
      );
      await collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT);

      const shareBase = ethers.parseUnits("1000", 18);
      const totalShares = ethers.parseUnits("10000", 18);

      // 第一次清算周期
      await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);
      const balance1 = await paymentToken.balanceOf(recipient.address);
      await collateralVault.transferLiquidatableCollateral(recipient.address, shareBase, totalShares, 1);
      const received1 = (await paymentToken.balanceOf(recipient.address)) - balance1;

      // 第二次清算周期
      await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);
      const balance2 = await paymentToken.balanceOf(recipient.address);
      await collateralVault.transferLiquidatableCollateral(recipient.address, shareBase, totalShares, 1);
      const received2 = (await paymentToken.balanceOf(recipient.address)) - balance2;

      // 每次清算应该收到相同的金额
      expect(received1).to.equal(received2);
    });
  });

  describe("边界条件测试", function () {
    it("应该处理最小金额", async function () {
      const minAmount = 1n;

      await collateralVault.recordFundraise(buyer1.address, minAmount);
      expect(await collateralVault.totalFundraisedAmount()).to.equal(minAmount);
    });

    it("应该处理大额金额", async function () {
      const largeAmount = ethers.parseUnits("1000000000", 6); // 10亿 USDT

      await collateralVault.recordFundraise(buyer1.address, largeAmount);
      expect(await collateralVault.totalFundraisedAmount()).to.equal(largeAmount);
    });

    it("应该处理精度计算", async function () {
      // 测试清算金额计算的精度
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        COLLATERAL_AMOUNT
      );
      await collateralVault.connect(provider).depositCollateralByProvider(COLLATERAL_AMOUNT);
      await collateralVault.updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);

      // 使用会导致精度损失的份额
      const shareBase = ethers.parseUnits("333", 18);
      const totalShares = ethers.parseUnits("10000", 18);

      const beforeBalance = await paymentToken.balanceOf(recipient.address);
      await collateralVault.transferLiquidatableCollateral(recipient.address, shareBase, totalShares, 1);
      const afterBalance = await paymentToken.balanceOf(recipient.address);

      // 应该有转账（即使金额很小）
      expect(afterBalance).to.be.gt(beforeBalance);
    });

    it("空金库应该正确处理查询", async function () {
      expect(await collateralVault.getAvailableRevenue()).to.equal(0);
      expect(await collateralVault.totalFundraisedAmount()).to.equal(0);
      expect(await collateralVault.totalCollateralAmount()).to.equal(0);
    });
  });

  describe("状态一致性测试", function () {
    it("已提取金额不应该超过总募集金额", async function () {
      await collateralVault.recordFundraise(buyer1.address, FUNDRAISE_AMOUNT);
      await paymentToken.transfer(await collateralVault.getAddress(), FUNDRAISE_AMOUNT);

      await collateralVault.withdrawFundraise(recipient.address, FUNDRAISE_AMOUNT / 2n);

      const total = await collateralVault.totalFundraisedAmount();
      const withdrawn = await collateralVault.totalWithdrawnFundraise();
      expect(withdrawn).to.be.lte(total);
    });

    it("已分配收益不应该超过已存入收益", async function () {
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        REVENUE_AMOUNT
      );
      await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);
      await collateralVault.transferRevenue(recipient.address, REVENUE_AMOUNT / 2n);

      const deposited = await collateralVault.depositedRevenue();
      const distributed = await collateralVault.distributedRevenue();
      expect(distributed).to.be.lte(deposited);
    });

    it("可用收益计算应该正确", async function () {
      await paymentToken.connect(provider).approve(
        await collateralVault.getAddress(),
        REVENUE_AMOUNT
      );
      await collateralVault.connect(provider).depositRevenue(REVENUE_AMOUNT);
      await collateralVault.transferRevenue(recipient.address, REVENUE_AMOUNT / 3n);

      const deposited = await collateralVault.depositedRevenue();
      const distributed = await collateralVault.distributedRevenue();
      const available = await collateralVault.getAvailableRevenue();

      expect(available).to.equal(deposited - distributed);
    });
  });
});

