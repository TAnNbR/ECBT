const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  // 从环境变量或 deployment-info.json 获取合约地址
  const fs = require('fs');
  const network = hre.network.name;
  
  // 根据网络选择正确的部署文件
  let deploymentFile = 'deployment-info.json';
  if (network === 'sepolia') {
    deploymentFile = 'deployment-info-sepolia.json';
  }
  
  console.log("Network:", network);
  console.log("Deployment File:", deploymentFile);
  
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const assetTokenAddress = deploymentInfo.contracts?.AssetToken || deploymentInfo.AssetToken;
  console.log("AssetToken Address:", assetTokenAddress);
  
  const assetToken = await hre.ethers.getContractAt("AssetToken", assetTokenAddress);
  
  console.log("=".repeat(60));
  console.log("检查 Frozen Amount");
  console.log("=".repeat(60));
  
  // 获取用户地址（从环境变量或使用 deployer）
  const userAddress = process.env.USER_ADDRESS || deployer.address;
  
  console.log("\n用户地址:", userAddress);
  
  // 获取余额信息
  const balance = await assetToken.balanceOf(userAddress);
  const frozenAmount = await assetToken.frozenAmounts(userAddress);
  
  console.log("\n余额信息:");
  console.log("  Total Balance:", hre.ethers.formatUnits(balance, 18));
  console.log("  Frozen Amount:", hre.ethers.formatUnits(frozenAmount, 18));
  console.log("  Available:", hre.ethers.formatUnits(balance - frozenAmount, 18));
  
  // 获取用户订单
  try {
    const orderBookAddress = await assetToken.orderBook();
    const orderBook = await hre.ethers.getContractAt("OrderBook", orderBookAddress);
    const userOrders = await orderBook.getUserOrders(userAddress);
    
    console.log("\n用户订单:");
    console.log("  订单数量:", userOrders.length);
    
    for (const orderId of userOrders) {
      const order = await orderBook.getOrder(orderId);
      const statusText = ["Active", "Filled", "Cancelled"][order.status];
      const remainingAmount = order.amount - order.filledAmount;
      
      console.log(`\n  Order #${orderId}:`);
      console.log(`    Status: ${statusText}`);
      console.log(`    Amount: ${hre.ethers.formatUnits(order.amount, 18)}`);
      console.log(`    Filled: ${hre.ethers.formatUnits(order.filledAmount, 18)}`);
      console.log(`    Remaining: ${hre.ethers.formatUnits(remainingAmount, 18)}`);
      console.log(`    Price: ${hre.ethers.formatUnits(order.price, 18)} USDT/token`);
    }
  } catch (error) {
    console.log("\n获取订单信息失败:", error.message);
  }
  
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

