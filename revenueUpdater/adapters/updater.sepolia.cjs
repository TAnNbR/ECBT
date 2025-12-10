// updater.sepolia.cjs
// Sepolia 实时收益更新服务

const axios = require('axios');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

// 加载 Sepolia 配置
const configPath = path.join(__dirname, '../config.sepolia.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 配置
const ADAPTER_URL = `http://localhost:${config.settings.adapterPort}`;
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || config.settings.updateInterval);
const ENABLE_ONCHAIN = process.env.ENABLE_ONCHAIN !== 'false'; // 默认启用
const RPC_URL = process.env.RPC_URL || config.rpcUrl;
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.ADAPTER_CONTRACT || config.contracts.revenueManager;
const ASSET_ID = process.env.ASSET_ID || config.settings.assetId;

// RevenueManager ABI
const REVENUE_MANAGER_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "periodRevenue", "type": "uint256" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "recordPeriodRevenue",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastestAccumulatedRevenue",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurrentAccumulatedRevenue",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// 状态
let provider;
let signer;
let updateCount = 0;
let successCount = 0;
let failCount = 0;

/**
 * 格式化收益数值（6位精度 - USDT标准）
 */
function formatRevenue(value) {
  const usdtValue = Number(value) / 1e6;  // 6位精度
  return `${usdtValue.toFixed(6)} USDT`;
}

/**
 * 从 Adapter 获取收益数据
 */
async function getRevenueFromAdapter() {
  try {
    const response = await axios.post(ADAPTER_URL, {
      id: `update-${Date.now()}`,
      data: { assetId: ASSET_ID }
    }, {
      timeout: 5000
    });
    
    if (response.data && response.data.status === 'completed') {
      return {
        periodRevenue: response.data.data.periodRevenue,
        timestamp: response.data.data.timestamp
      };
    }
    
    throw new Error('Invalid adapter response');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('无法连接到 Adapter 服务，请确保 adapter.cjs 正在运行');
    }
    throw error;
  }
}

/**
 * 更新链上收益
 */
async function updateOnchain(data) {
  if (!ENABLE_ONCHAIN) {
    console.log('   ℹ️  链上更新已禁用 (ENABLE_ONCHAIN=false)');
    return null;
  }

  if (!signer) {
    throw new Error('未配置私钥，无法发送交易');
  }

  const revenueManager = new ethers.Contract(CONTRACT_ADDRESS, REVENUE_MANAGER_ABI, signer);
  
  // 发送交易
  console.log(`   📤 发送交易...`);
  const tx = await revenueManager.recordPeriodRevenue(
    BigInt(data.periodRevenue),
    data.timestamp,
    {
      gasLimit: 500000 // 设置 gas limit
    }
  );
  
  console.log(`   ⏳ 等待确认... (tx: ${tx.hash.slice(0, 10)}...)`);
  const receipt = await tx.wait();
  
  return receipt;
}

/**
 * 执行一次更新周期
 */
async function runUpdateCycle() {
  updateCount++;
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔄 更新周期 #${updateCount} - ${timestamp}`);
  console.log(`${'='.repeat(70)}`);

  try {
    // 步骤 1: 从 Adapter 获取数据
    console.log(`\n📡 步骤 1: 从 Adapter 获取收益数据...`);
    const data = await getRevenueFromAdapter();
    
    console.log(`   ✅ 数据获取成功:`);
    console.log(`      资产 ID: ${ASSET_ID}`);
    console.log(`      周期收益: ${formatRevenue(data.periodRevenue)}`);
    console.log(`      时间戳: ${data.timestamp} (${new Date(data.timestamp * 1000).toLocaleString('zh-CN')})`);

    // 步骤 2: 更新到链上
    console.log(`\n⛓️  步骤 2: 更新到 Sepolia RevenueManager...`);
    console.log(`   合约地址: ${CONTRACT_ADDRESS}`);
    
    const receipt = await updateOnchain(data);
    
    if (receipt) {
      console.log(`   ✅ 链上更新成功!`);
      console.log(`      区块号: ${receipt.blockNumber}`);
      console.log(`      Gas 使用: ${receipt.gasUsed.toString()}`);
      console.log(`      交易哈希: ${receipt.hash}`);
      console.log(`      Etherscan: https://sepolia.etherscan.io/tx/${receipt.hash}`);
      successCount++;
      
      // 查询更新后的累计收益
      const revenueManager = new ethers.Contract(CONTRACT_ADDRESS, REVENUE_MANAGER_ABI, provider);
      const totalRevenue = await revenueManager.getCurrentAccumulatedRevenue();
      console.log(`      当前累计总收益: ${formatRevenue(totalRevenue)}`);
    }

    // 统计信息
    console.log(`\n📊 统计信息:`);
    console.log(`   总更新次数: ${updateCount}`);
    console.log(`   成功: ${successCount} | 失败: ${failCount}`);
    console.log(`   成功率: ${((successCount / updateCount) * 100).toFixed(2)}%`);

  } catch (error) {
    failCount++;
    console.error(`\n❌ 更新失败:`);
    console.error(`   错误: ${error.message}`);
    if (error.code) console.error(`   错误代码: ${error.code}`);
    if (error.reason) console.error(`   原因: ${error.reason}`);
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

/**
 * 启动更新服务
 */
async function startUpdater() {
  console.log('\n🚀 Sepolia 实时收益更新服务\n');
  console.log(`📝 配置信息:`);
  console.log(`   网络: Sepolia (Chain ID: 11155111)`);
  console.log(`   RPC URL: ${RPC_URL}`);
  console.log(`   RevenueManager: ${CONTRACT_ADDRESS}`);
  console.log(`   Adapter URL: ${ADAPTER_URL}`);
  console.log(`   资产 ID: ${ASSET_ID}`);
  console.log(`   更新间隔: ${UPDATE_INTERVAL / 1000} 秒`);
  console.log(`   链上更新: ${ENABLE_ONCHAIN ? '✅ 启用' : '❌ 禁用'}`);

  // 初始化 provider
  provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    const network = await provider.getNetwork();
    console.log(`   连接成功: Chain ID ${network.chainId}`);
    
    if (network.chainId !== 11155111n) {
      console.warn(`   ⚠️  警告: 当前网络不是 Sepolia (Chain ID: ${network.chainId})`);
    }
  } catch (error) {
    console.error(`\n❌ 无法连接到 RPC:`);
    console.error(`   ${error.message}`);
    console.error(`\n💡 请检查:`);
    console.error(`   1. RPC URL 是否正确`);
    console.error(`   2. 网络连接是否正常`);
    console.error(`   3. Infura/Alchemy API Key 是否有效`);
    process.exit(1);
  }

  // 初始化 signer
  if (ENABLE_ONCHAIN) {
    if (!PRIVATE_KEY) {
      console.error(`\n❌ 错误: 启用了链上更新但未配置私钥`);
      console.error(`   请设置环境变量: PRIVATE_KEY=0x...`);
      process.exit(1);
    }

    try {
      signer = new ethers.Wallet(PRIVATE_KEY, provider);
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      
      console.log(`\n👛 钱包信息:`);
      console.log(`   地址: ${address}`);
      console.log(`   余额: ${ethers.formatEther(balance)} ETH`);
      
      if (balance === 0n) {
        console.warn(`   ⚠️  警告: 钱包余额为 0，无法发送交易`);
        console.warn(`   请先充值 Sepolia ETH: https://sepoliafaucet.com/`);
      }
    } catch (error) {
      console.error(`\n❌ 私钥无效:`, error.message);
      process.exit(1);
    }
  }

  // 检查 Adapter 服务
  console.log(`\n🔍 检查 Adapter 服务...`);
  try {
    await axios.get(`${ADAPTER_URL}/health`, { timeout: 3000 });
    console.log(`   ✅ Adapter 服务运行中`);
  } catch (error) {
    console.error(`   ❌ 无法连接到 Adapter 服务`);
    console.error(`   请先启动: node adapters/adapter.cjs`);
    process.exit(1);
  }

  console.log(`\n✅ 所有检查通过，开始更新...\n`);
  console.log(`⏳ 按 CTRL+C 停止服务\n`);

  // 立即执行一次
  await runUpdateCycle();

  // 定时执行
  const intervalId = setInterval(runUpdateCycle, UPDATE_INTERVAL);

  // 处理退出
  process.on('SIGINT', () => {
    console.log(`\n\n👋 服务已停止`);
    console.log(`\n📊 最终统计:`);
    console.log(`   总更新次数: ${updateCount}`);
    console.log(`   成功: ${successCount}`);
    console.log(`   失败: ${failCount}`);
    if (updateCount > 0) {
      console.log(`   成功率: ${((successCount / updateCount) * 100).toFixed(2)}%`);
    }
    clearInterval(intervalId);
    process.exit(0);
  });
}

// 启动服务
startUpdater().catch((error) => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});

