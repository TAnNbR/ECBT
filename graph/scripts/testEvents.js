const hre = require("hardhat");

async function main() {
  const address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  // 连接到 localhost 网络（hardhat node）
  const provider = new hre.ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  const code = await provider.getCode(address);
  console.log("合约存在:", code !== "0x");
  
  const logs = await provider.getLogs({
    address: address,
    fromBlock: 0,
    toBlock: 'latest'
  });
  
  console.log("事件总数:", logs.length);
  
  if (logs.length > 0) {
    console.log("第一个事件区块:", logs[0].blockNumber);
    console.log("最后一个事件区块:", logs[logs.length - 1].blockNumber);
  }
}

main();
