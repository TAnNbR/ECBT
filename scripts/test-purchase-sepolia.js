const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("在 Sepolia 上测试购买资产代币...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info-sepolia.json', 'utf8'));
  
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;
  const collateralVaultAddress = deploymentInfo.contracts.CollateralVault;

  console.log("合约地址:");
  console.log("  AssetToken:", assetTokenAddress);
  console.log("  PaymentToken (USDT):", paymentTokenAddress);
  console.log("  CollateralVault:", collateralVaultAddress);
  console.log("");

  // 获取合约实例
  const assetToken = await ethers.getContractAt("AssetToken", assetTokenAddress);
  const paymentToken = await ethers.getContractAt("MockERC20", paymentTokenAddress);

  const [buyer] = await ethers.getSigners();
  console.log("购买账户:", buyer.address);

  // 购买金额：1000 个资产代币
  const purchaseAmount = ethers.parseUnits("1000", 18);
  
  // 获取资产元数据
  const metadata = await assetToken.metadata();
  
  // 计算需要支付的 USDT
  const paymentAmount = (purchaseAmount * metadata.fundraiseAmount) / metadata.maxTotalSupply;
  
  console.log("\n购买信息:");
  console.log("  购买数量:", ethers.formatUnits(purchaseAmount, 18), "代币");
  console.log("  需要支付:", ethers.formatUnits(paymentAmount, 6), "USDT");

  // 检查余额
  const usdtBalance = await paymentToken.balanceOf(buyer.address);
  console.log("\n当前余额:");
  console.log("  USDT:", ethers.formatUnits(usdtBalance, 6));
  
  if (usdtBalance < paymentAmount) {
    console.log("\n❌ USDT 余额不足！");
    process.exit(1);
  }

  // 步骤 1: 授权 USDT 给 AssetToken 合约
  console.log("\n步骤 1: 授权 USDT 给 AssetToken 合约...");
  const currentAllowance = await paymentToken.allowance(buyer.address, assetTokenAddress);
  console.log("  当前授权额度:", ethers.formatUnits(currentAllowance, 6), "USDT");

  if (currentAllowance < paymentAmount) {
    console.log("  需要授权...");
    const approveTx = await paymentToken.approve(assetTokenAddress, paymentAmount);
    console.log("  授权交易已发送:", approveTx.hash);
    await approveTx.wait();
    console.log("  ✓ 授权成功");
  } else {
    console.log("  ✓ 授权额度充足");
  }

  // 步骤 2: 购买资产代币
  console.log("\n步骤 2: 购买资产代币...");
  
  // 获取当前资产代币余额
  const assetBalanceBefore = await assetToken.balanceOf(buyer.address);
  
  try {
    const purchaseTx = await assetToken.purchase(purchaseAmount, {
      gasLimit: 500000 // 手动设置合理的 gas limit
    });
    console.log("  购买交易已发送:", purchaseTx.hash);
    console.log("  等待确认...");
    
    await purchaseTx.wait();
    console.log("  ✓ 购买成功！");

    // 检查购买后余额
    const assetBalanceAfter = await assetToken.balanceOf(buyer.address);
    const usdtBalanceAfter = await paymentToken.balanceOf(buyer.address);

    console.log("\n购买后余额:");
    console.log("  资产代币:", ethers.formatUnits(assetBalanceAfter, 18));
    console.log("  USDT:", ethers.formatUnits(usdtBalanceAfter, 6));
    console.log("  获得代币:", ethers.formatUnits(assetBalanceAfter - assetBalanceBefore, 18));
    console.log("  花费 USDT:", ethers.formatUnits(usdtBalance - usdtBalanceAfter, 6));

    console.log("\n✅ 交易成功！");
    console.log("\n在 Sepolia Etherscan 查看:");
    console.log("  https://sepolia.etherscan.io/tx/" + purchaseTx.hash);
  } catch (error) {
    console.error("\n❌ 购买失败:", error.message);
    
    if (error.message.includes("Insufficient remaining supply")) {
      console.log("\n提示: 代币已售罄或供应量不足");
    } else if (error.message.includes("Payment transfer failed")) {
      console.log("\n提示: USDT 转账失败，请检查授权");
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

