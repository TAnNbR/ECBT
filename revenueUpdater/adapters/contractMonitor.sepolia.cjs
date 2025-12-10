// contractMonitor.sepolia.cjs
// Sepolia RevenueManager 合约状态监控脚本

const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

// 加载 Sepolia 配置
const configPath = path.join(__dirname, '../config.sepolia.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 从环境变量或配置文件获取设置
const RPC_URL = process.env.RPC_URL || config.rpcUrl;
const CONTRACT_ADDRESS = process.env.ADAPTER_CONTRACT || config.contracts.revenueManager;
const MONITOR_INTERVAL = parseInt(process.env.MONITOR_INTERVAL || config.settings.monitorInterval);

// RevenueManager ABI
const REVENUE_MANAGER_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "timestamp", "type": "uint256" }],
    "name": "getAccumulatedRevenueAt",
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
  },
  {
    "inputs": [],
    "name": "unitSeconds",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastestAccumulatedRevenue",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// 全局变量
let provider;
let revenueManager;

/**
 * 格式化大数值为可读的收益格式（USDT, 6位精度）
 */
function formatRevenue(value) {
  const usdtValue = Number(value) / 1e18; // 从18位精度转换
  return `${usdtValue.toFixed(6)} USDT (${value.toString()} Wei)`;
}

/**
 * 格式化时间戳
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', { 
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
}

/**
 * 获取当前截断时间戳
 */
async function getCurrentTruncatedTimestamp() {
  const unitSeconds = await revenueManager.unitSeconds();
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return currentTimestamp - (currentTimestamp % Number(unitSeconds));
}

/**
 * 监控合约状态
 */
async function monitorContractState() {
  try {
    console.log(`\n========== ${new Date().toISOString()} ==========`);
    
    // 获取当前截断时间戳
    const currentTruncatedTimestamp = await getCurrentTruncatedTimestamp();
    
    // 查询合约数据
    const currentRevenue = await revenueManager.getCurrentAccumulatedRevenue();
    const revenueAt = await revenueManager.getAccumulatedRevenueAt(currentTruncatedTimestamp);
    const unitSeconds = await revenueManager.unitSeconds();
    
    // 输出数据
    console.log(`\n📊 RevenueManager 状态:`);
    console.log(`   合约地址: ${CONTRACT_ADDRESS}`);
    console.log(`   网络: Sepolia (Chain ID: 11155111)`);
    console.log(`\n💰 收益数据:`);
    console.log(`   当前累计总收益: ${formatRevenue(currentRevenue)}`);
    console.log(`   当前时间点收益: ${formatRevenue(revenueAt)}`);
    console.log(`\n⏰ 时间信息:`);
    console.log(`   时间单位: ${unitSeconds} 秒 (${Number(unitSeconds)/86400} 天)`);
    console.log(`   截断时间戳: ${currentTruncatedTimestamp}`);
    console.log(`   对应时间: ${formatTimestamp(currentTruncatedTimestamp)}`);
    console.log(`\n${'='.repeat(60)}`);
  } catch (error) {
    console.error('❌ 监控错误:', error.message);
    if (error.code) console.error('   错误代码:', error.code);
  }
}

/**
 * 启动监控服务
 */
async function startMonitor() {
  console.log('\n🚀 启动 Sepolia RevenueManager 监控服务\n');
  console.log(`📝 配置信息:`);
  console.log(`   RPC URL: ${RPC_URL}`);
  console.log(`   合约地址: ${CONTRACT_ADDRESS}`);
  console.log(`   监控间隔: ${MONITOR_INTERVAL/1000} 秒`);
  console.log(`   配置文件: ${configPath}`);

  // 初始化 ethers
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    revenueManager = new ethers.Contract(CONTRACT_ADDRESS, REVENUE_MANAGER_ABI, provider);
    
    // 测试连接
    await revenueManager.unitSeconds();
    console.log(`\n✅ 合约连接成功！\n`);
  } catch (error) {
    console.error('\n❌ 合约连接失败:', error.message);
    console.error('   请检查 RPC_URL 和合约地址是否正确');
    process.exit(1);
  }

  // 立即执行一次监控
  await monitorContractState();

  // 设置定时器
  const intervalId = setInterval(monitorContractState, MONITOR_INTERVAL);

  console.log(`\n⏳ 监控运行中... (按 CTRL+C 退出)`);

  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n\n👋 监控服务已停止');
    clearInterval(intervalId);
    process.exit(0);
  });
}

// 启动监控
startMonitor().catch((error) => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});

