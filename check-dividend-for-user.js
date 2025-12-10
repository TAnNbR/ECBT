const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const userAddress = "0xA0661DAfebB84C53d88842b6C7BbcEAfa92DaFDe";
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;
  const vaultAddress = deploymentInfo.contracts.CollateralVault;
  
  console.log("🔍 检查用户分红情况");
  console.log("===================");
  console.log("用户地址:", userAddress);
  console.log("");

  const AssetToken = await hre.ethers.getContractAt("AssetToken", assetTokenAddress);
  const PaymentToken = await hre.ethers.getContractAt("MockERC20", paymentTokenAddress);
  const CollateralVault = await hre.ethers.getContractAt("CollateralVault", vaultAddress);

  // 1. 检查用户资产代币余额
  const balance = await AssetToken.balanceOf(userAddress);
  const totalSupply = await AssetToken.totalSupply();
  
  console.log("1️⃣ 用户持有情况:");
  console.log("   资产代币余额:", hre.ethers.formatUnits(balance, 18));
  console.log("   总供应量:", hre.ethers.formatUnits(totalSupply, 18));
  console.log("   持有比例:", totalSupply > 0n ? ((Number(balance) * 100 / Number(totalSupply)).toFixed(4) + "%") : "0%");
  console.log("");

  // 2. 检查 USDT 余额变化
  const usdtBalance = await PaymentToken.balanceOf(userAddress);
  console.log("2️⃣ 用户 USDT 余额:");
  console.log("   当前余额:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
  console.log("");

  // 3. 使用 staticcall 模拟分红提取
  console.log("3️⃣ 模拟分红提取:");
  try {
    const dividendAmount = await AssetToken.withdrawDividend.staticCall(userAddress, userAddress);
    console.log("   ✅ 可领取分红:", hre.ethers.formatUnits(dividendAmount, 6), "USDT");
    console.log("   Raw value:", dividendAmount.toString());
    console.log("");
  } catch (error) {
    console.log("   ❌ 无法提取分红");
    console.log("   错误:", error.message);
    console.log("");
  }

  // 4. 检查 RevenueManager 累计收益
  const revenueManagerAddress = deploymentInfo.contracts.RevenueManager;
  const RevenueManager = await hre.ethers.getContractAt("RevenueManager", revenueManagerAddress);
  const accumulatedRevenue = await RevenueManager.lastestAccumulatedRevenue();
  
  console.log("4️⃣ RevenueManager 累计收益:");
  console.log("   累计收益:", hre.ethers.formatUnits(accumulatedRevenue, 6), "USDT");
  console.log("");

  // 5. 检查 CollateralVault 可用收益
  const depositedRevenue = await CollateralVault.depositedRevenue();
  const distributedRevenue = await CollateralVault.distributedRevenue();
  const availableRevenue = depositedRevenue - distributedRevenue;
  
  console.log("5️⃣ CollateralVault 收益状态:");
  console.log("   已存入:", hre.ethers.formatUnits(depositedRevenue, 6), "USDT");
  console.log("   已分配:", hre.ethers.formatUnits(distributedRevenue, 6), "USDT");
  console.log("   可用余额:", hre.ethers.formatUnits(availableRevenue, 6), "USDT");
  console.log("");

  // 6. 计算用户应得分红
  if (balance > 0n && totalSupply > 0n && accumulatedRevenue > 0n) {
    const userShare = (balance * accumulatedRevenue) / totalSupply;
    console.log("6️⃣ 理论应得分红:");
    console.log("   计算: (用户余额 / 总供应) × 累计收益");
    console.log("   应得:", hre.ethers.formatUnits(userShare, 6), "USDT");
    console.log("");
    
    // 检查是否足够
    if (availableRevenue < userShare) {
      console.log("   ⚠️  问题: Vault 可用余额不足!");
      console.log("   需要:", hre.ethers.formatUnits(userShare, 6), "USDT");
      console.log("   可用:", hre.ethers.formatUnits(availableRevenue, 6), "USDT");
      console.log("   缺少:", hre.ethers.formatUnits(userShare - availableRevenue, 6), "USDT");
    } else {
      console.log("   ✅ Vault 有足够余额");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
