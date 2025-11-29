// contractMonitor.cjs
// RevenueManager 合约状态监控脚本 - 调用查看函数监听合约状态

const ethers = require('ethers');

// 配置
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.ADAPTER_CONTRACT || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const MONITOR_INTERVAL = 15000; // 15秒 (每分钟4次：15秒、30秒、45秒、60秒)

// RevenueManager ABI - 只包含两个查看函数
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
  }
];

// 全局变量
let provider;
let revenueManager;

/**
 * 格式化大数值为可读的收益格式
 * @param {BigInt} value - 18位精度的数值
 * @returns {string} 格式化后的字符串
 */
function formatRevenue(value) {
  const ethValue = Number(value) / 1e18;
  return `${ethValue.toFixed(6)} (${value.toString()} Wei)`;
}

/**
 * 格式化时间戳为可读格式
 * @param {number} timestamp - Unix 时间戳
 * @returns {string} 格式化后的时间字符串
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
    hour12: false
  });
}

/**
 * 获取当前截断时间戳
 * @returns {Promise<number>} 截断后的时间戳
 */
async function getCurrentTruncatedTimestamp() {
  const unitSeconds = await revenueManager.unitSeconds();
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return currentTimestamp - (currentTimestamp % Number(unitSeconds));
}

/**
 * 监控合约状态 - 每15秒调用一次 (每分钟4次)
 */
async function monitorContractState() {
  try {
    const now = new Date();
    const seconds = now.getSeconds();
    
    // 获取当前截断时间戳
    const currentTruncatedTimestamp = await getCurrentTruncatedTimestamp();
    
    // 查询两个函数
    const currentRevenue = await revenueManager.getCurrentAccumulatedRevenue();
    const revenueAt = await revenueManager.getAccumulatedRevenueAt(currentTruncatedTimestamp);
    
    // 输出当前收益、截断时间戳和对应时间点的收益
    console.log(`当前累计总收益: ${formatRevenue(currentRevenue)}`);
    console.log(`截断后的时间戳: ${currentTruncatedTimestamp}`);
    console.log(`当前时间点的收益: ${formatRevenue(revenueAt)}`);
    console.log(`对应时间戳的可读时间: ${formatTimestamp(currentTruncatedTimestamp)}`);
    console.log('-----------------------------');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * 启动监控服务
 */
async function startMonitor() {
  // 初始化 ethers
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    revenueManager = new ethers.Contract(CONTRACT_ADDRESS, REVENUE_MANAGER_ABI, provider);
    await revenueManager.unitSeconds();
  } catch (error) {
    console.error('Contract connection failed:', error.message);
    process.exit(1);
  }

  // 立即执行一次监控
  await monitorContractState();

  // 设置定时器，每15秒执行一次 (每分钟4次)
  const intervalId = setInterval(monitorContractState, MONITOR_INTERVAL);

  // 处理退出信号
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    process.exit(0);
  });
}

// 启动监控
startMonitor().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
