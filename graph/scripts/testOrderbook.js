const hre = require("hardhat");

let orderIdCounter = 1;

async function deploy() {
  const [deployer, seller, buyer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);

  // Deploy mock payment token (USDT)
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const paymentToken = await MockERC20.deploy("Mock USDT", "USDT", 18);
  await paymentToken.waitForDeployment();
  const paymentTokenAddress = await paymentToken.getAddress();
  console.log("PaymentToken deployed to:", paymentTokenAddress);

  // Deploy OrderBook
  const OrderBook = await hre.ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(
    paymentTokenAddress,
    deployer.address,
    30
  );
  await orderBook.waitForDeployment();
  const orderBookAddress = await orderBook.getAddress();
  console.log("OrderBook deployed to:", orderBookAddress);

  // Mint tokens
  await paymentToken.mint(buyer.address, hre.ethers.parseEther("1000000"));
  console.log("Minted 1000000 USDT to buyer");

  // Approve OrderBook
  await paymentToken.connect(buyer).approve(orderBookAddress, hre.ethers.parseEther("1000000"));
  console.log("Buyer approved OrderBook");

  // Save addresses
  const fs = require('fs');
  fs.writeFileSync('deployed-addresses.json', JSON.stringify({
    orderBook: orderBookAddress,
    paymentToken: paymentTokenAddress,
    network: "localhost",
    chainId: 31337
  }, null, 2));

  return { orderBook, paymentToken, seller, buyer };
}

async function runCycle(orderBook, seller, buyer) {
  try {
    const currentOrderId = orderIdCounter++;
    const timestamp = new Date().toLocaleTimeString();
    
    // 1. 创建订单
    console.log(`\n[${timestamp}] === Creating Order #${currentOrderId} ===`);
    const amount = hre.ethers.parseEther((Math.random() * 100 + 50).toFixed(2));
    const price = hre.ethers.parseEther((Math.random() * 20 + 10).toFixed(2));
    
    const tx1 = await orderBook.connect(seller).createSellOrder(amount, price);
    await tx1.wait();
    console.log(`Order #${currentOrderId} created: ${hre.ethers.formatEther(amount)} tokens at ${hre.ethers.formatEther(price)} USDT each`);

    // 2. 购买订单（部分或全部）
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`[${timestamp}] === Filling Order #${currentOrderId} ===`);
    const fillAmount = hre.ethers.parseEther((Math.random() * parseFloat(hre.ethers.formatEther(amount))).toFixed(2));
    
    const tx2 = await orderBook.connect(buyer).fillOrder(currentOrderId, fillAmount);
    await tx2.wait();
    console.log(`Order #${currentOrderId} filled: ${hre.ethers.formatEther(fillAmount)} tokens`);

    // 3. 创建一个新订单用于取消
    await new Promise(resolve => setTimeout(resolve, 2000));
    const cancelOrderId = orderIdCounter++;
    console.log(`[${timestamp}] === Creating Order #${cancelOrderId} for Cancel ===`);
    
    const tx3 = await orderBook.connect(seller).createSellOrder(
      hre.ethers.parseEther("100"),
      hre.ethers.parseEther("15")
    );
    await tx3.wait();
    console.log(`Order #${cancelOrderId} created for cancellation`);

    // 4. 取消订单
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`[${timestamp}] === Cancelling Order #${cancelOrderId} ===`);
    
    const tx4 = await orderBook.connect(seller).cancelOrder(cancelOrderId);
    await tx4.wait();
    console.log(`Order #${cancelOrderId} cancelled`);

  } catch (error) {
    console.error("Error in cycle:", error.message);
  }
}

async function main() {
  console.log("=== Deploying Contracts ===\n");
  const { orderBook, paymentToken, seller, buyer } = await deploy();
  
  console.log("\n=== Starting Continuous Operations (every 10 seconds) ===");
  console.log("Press Ctrl+C to stop\n");

  // 立即执行一次
  await runCycle(orderBook, seller, buyer);

  // 每10秒执行一次
  setInterval(async () => {
    await runCycle(orderBook, seller, buyer);
  }, 10000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



