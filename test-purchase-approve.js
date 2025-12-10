const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  const data = fs.readFileSync('./deployment-info-sepolia.json', 'utf8');
  const deploymentInfo = JSON.parse(data);

  const userAddress = "0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7";
  
  const assetTokenAddress = deploymentInfo.contracts.AssetToken;
  const paymentTokenAddress = deploymentInfo.contracts.MockERC20;
  
  console.log("🧪 Testing Purchase & Approval (Sepolia)");
  console.log("=========================================");
  console.log("User:", userAddress);
  console.log("");

  const AssetToken = await hre.ethers.getContractAt("AssetToken", assetTokenAddress);
  const PaymentToken = await hre.ethers.getContractAt("MockERC20", paymentTokenAddress);

  // 1. 检查用户 USDT 余额
  const usdtBalance = await PaymentToken.balanceOf(userAddress);
  console.log("1️⃣ User USDT Balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
  console.log("");

  // 2. 检查当前授权额度
  const currentAllowance = await PaymentToken.allowance(userAddress, assetTokenAddress);
  console.log("2️⃣ Current Allowance:");
  console.log("   User → AssetToken:", hre.ethers.formatUnits(currentAllowance, 6), "USDT");
  console.log("");

  // 3. 检查剩余供应量
  const remainingSupply = await AssetToken.remainingMintableSupply();
  const soldOutTimestamp = await AssetToken.soldOutTimestamp();
  console.log("3️⃣ Token Supply Status:");
  console.log("   Remaining Supply:", hre.ethers.formatUnits(remainingSupply, 18));
  console.log("   Sold Out:", soldOutTimestamp > 0n ? "YES" : "NO");
  console.log("");

  // 4. 模拟购买
  const purchaseAmount = hre.ethers.parseUnits("100", 18); // 购买100个代币
  const metadata = await AssetToken.metadata();
  const paymentRequired = (purchaseAmount * metadata.fundraiseAmount) / metadata.maxTotalSupply;
  
  console.log("4️⃣ Purchase Simulation:");
  console.log("   Want to buy:", hre.ethers.formatUnits(purchaseAmount, 18), "tokens");
  console.log("   Payment required:", hre.ethers.formatUnits(paymentRequired, 6), "USDT");
  console.log("   Has enough USDT:", usdtBalance >= paymentRequired ? "YES ✅" : "NO ❌");
  console.log("   Has enough allowance:", currentAllowance >= paymentRequired ? "YES ✅" : "NO ❌");
  console.log("");

  // 5. 尝试模拟购买
  console.log("5️⃣ Simulating Purchase Transaction:");
  try {
    await AssetToken.purchase.staticCall(purchaseAmount, {
      from: userAddress
    });
    console.log("   ✅ Purchase simulation SUCCESS!");
  } catch (error) {
    console.log("   ❌ Purchase simulation FAILED!");
    console.log("   Error:", error.message);
    
    if (error.message.includes("Insufficient remaining supply")) {
      console.log("   → Token is sold out!");
    } else if (error.message.includes("ERC20: insufficient allowance")) {
      console.log("   → Need more allowance!");
      console.log("   → Required:", hre.ethers.formatUnits(paymentRequired, 6));
      console.log("   → Current:", hre.ethers.formatUnits(currentAllowance, 6));
    } else if (error.message.includes("ERC20: transfer amount exceeds balance")) {
      console.log("   → Insufficient USDT balance!");
    }
  }
  
  console.log("");
  console.log("📝 Summary:");
  console.log("   Approval target should be: AssetToken (" + assetTokenAddress + ")");
  console.log("   Current approval: " + hre.ethers.formatUnits(currentAllowance, 6) + " USDT");
  console.log("   Required for purchase: " + hre.ethers.formatUnits(paymentRequired, 6) + " USDT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
