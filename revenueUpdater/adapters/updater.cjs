// real-time-updater.cjs
// 实时自动更新系统 - 每5秒从API获取数据并更新合约

const axios = require('axios');

// 配置
const ADAPTER_URL = 'http://localhost:8080';
const UPDATE_INTERVAL = 5000; // 5秒
const ASSETS = ['Hotel', 'Meeting_Room', 'Office'];
const ENABLE_ONCHAIN = process.env.ENABLE_ONCHAIN === 'true';
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.ADAPTER_CONTRACT || '';
let RESOLVED_CONTRACT_ADDRESS = CONTRACT_ADDRESS;
let RESOLVED_SIGNER = null;
let PROVIDER = null;

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
  }
];

// 模拟合约状态
const contractData = {
  updateCount: 0
};

/**
 * 从Adapter获取指定资产的收益数据
 * @param {string} asset - 资产名称（如 'Hotel', 'Meeting_Room', 'Office'）
 * @returns {Promise<Object|null>} 返回包含 asset, periodRevenue, timestamp 的对象，失败返回 null
 */
async function getAdapterData(asset) {
  try {
    // 发送 POST 请求到 Adapter，请求指定资产的收益数据
    const response = await axios.post(ADAPTER_URL, {
      id: `real-time-${asset.toLowerCase()}-${Date.now()}`,  // 生成唯一请求 ID
      data: { assetId: asset }  // 传入资产 ID
    });
    
    // 返回处理后的数据：资产名、周期收益（18位精度）、时间戳
    return {
      asset,
      periodRevenue: response.data.data.periodRevenue,  // 18位精度的收益数据
      timestamp: response.data.data.timestamp  // 时间戳
    };
  } catch (error) {
    console.error(`Adapter请求失败: ${error.message}`);
    return null;  // 请求失败返回 null
  }
}

/**
 * 将收益数据更新到链上 RevenueManager 合约
 * @param {string} asset - 资产名称
 * @param {Object} data - 包含 periodRevenue 和 timestamp 的数据对象
 * @param {Object} signer - ethers.js 签名者对象
 * @param {string} contractAddress - RevenueManager 合约地址
 * @returns {Promise<Object|boolean>} 返回交易回执或 false（如果未启用链上更新）
 */
async function updateOnchain(asset, data, signer, contractAddress) {
  // 检查是否启用链上更新
  if (!ENABLE_ONCHAIN) return false;
  
  // 动态加载 ethers 库
  let ethers;
  try {
    ethers = require('ethers');
  } catch (e) {
    throw new Error('缺少 ethers 依赖');
  }
  
  // 验证必要的参数
  if (!signer || !contractAddress) {
    throw new Error(`缺少链上配置: signer 或合约地址`);
  }
  
  // 创建 RevenueManager 合约实例
  const revenueManager = new ethers.Contract(contractAddress, REVENUE_MANAGER_ABI, signer);
  
  // 调用合约的 recordPeriodRevenue 函数，记录周期收益
  const tx = await revenueManager.recordPeriodRevenue(
    BigInt(data.periodRevenue),  // 周期收益（转换为 BigInt）
    data.timestamp  // 时间戳
  );
  
  // 等待交易确认
  const receipt = await tx.wait();
  return receipt;
}

/**
 * 自动检测 RevenueManager 合约地址
 * 遍历账户的历史交易，尝试找到已部署的 RevenueManager 合约
 * @param {Object} provider - ethers.js provider 对象
 * @returns {Promise<string>} 返回检测到的合约地址，未找到返回空字符串
 */
async function autoDetectContractAddress(provider) {
  // 加载 ethers 库
  let ethers;
  try { ethers = require('ethers'); } catch { return ''; }
  
  try {
    // 获取所有账户
    const accounts = await provider.send('eth_accounts', []);
    
    // 遍历每个账户
    for (const acc of accounts) {
      // 获取账户的交易数量
      const txCount = await provider.getTransactionCount(acc);
      
      // 从最新的交易开始向后遍历
      for (let n = txCount - 1; n >= 0; n--) {
        // 计算该 nonce 创建的合约地址
        const addr = ethers.getCreateAddress({ from: acc, nonce: n });
        
        // 检查该地址是否有合约代码
        const code = await provider.getCode(addr);
        if (code && code !== '0x') {
          try {
            // 尝试调用 RevenueManager 的函数验证是否为目标合约
            const c = new ethers.Contract(addr, REVENUE_MANAGER_ABI, provider);
            await c.lastestAccumulatedRevenue();
            return addr;  // 找到目标合约，返回地址
          } catch {}
        }
      }
    }
  } catch {}
  
  return '';  // 未找到合约，返回空字符串
}

/**
 * 执行一次完整的更新周期
 * 1. 从 Adapter 获取所有资产的收益数据
 * 2. 将数据更新到链上 RevenueManager 合约
 * 3. 显示更新结果统计
 * @returns {Promise<void>}
 */
async function runUpdateCycle() {
  console.log(`\n==== 更新周期: ${new Date().toISOString()} ====`);
  
  // 步骤 1: 从 Adapter 获取所有资产的数据
  console.log('从Adapter获取数据...');
  const adapterResults = {};  // 存储所有资产的数据
  
  // 遍历所有配置的资产
  for (const asset of ASSETS) {
    const adapterData = await getAdapterData(asset);
    if (adapterData) {
      adapterResults[asset] = adapterData;  // 保存数据
      // 转换时间戳为可读格式并显示
      const time = new Date(adapterData.timestamp * 1000).toLocaleTimeString();
      console.log(`  ${asset}: periodRevenue=${adapterData.periodRevenue}, timestamp=${adapterData.timestamp} (${time})`);
    }
  }
  
  // 步骤 2: 将数据更新到链上合约
  console.log('\n更新 RevenueManager 合约...');
  for (const [asset, data] of Object.entries(adapterResults)) {
    // 检查链上更新条件：启用链上更新 + 有合约地址 + 有签名者
    if (ENABLE_ONCHAIN && RESOLVED_CONTRACT_ADDRESS && RESOLVED_SIGNER) {
      try {
        // 调用合约更新函数
        await updateOnchain(asset, data, RESOLVED_SIGNER, RESOLVED_CONTRACT_ADDRESS);
        console.log(`✓ ${asset} 已更新: periodRevenue=${data.periodRevenue}, timestamp=${data.timestamp}`);
        contractData.updateCount++;  // 更新计数器
        // 等待 500ms 避免 nonce 冲突（串行发送交易）
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.log(`✗ ${asset} 更新失败: ${err.message}`);
      }
    } else {
      console.log(`✗ ${asset}: 未配置合约地址或未连接区块链`);
    }
  }

  // 步骤 3: 显示统计信息
  console.log(`\n合约状态: 已完成 ${contractData.updateCount} 次更新`);
}

async function startRealTimeUpdater() {
  
  // 显示启动信息
  console.log('实时自动更新服务 - 每5秒更新一次\n');
  console.log(`启动时间: ${new Date().toISOString()}`);
  console.log(`更新间隔: ${UPDATE_INTERVAL/1000}秒`);
  console.log(`监控资产: ${ASSETS.join(', ')}`);
  console.log(`Adapter URL: ${ADAPTER_URL}`);
  
  // 初始化 ethers 库
  let ethersLib;
  try { ethersLib = require('ethers'); } catch (e) { console.log('✗ 缺少 ethers 依赖'); return; }
  
  // 创建区块链 provider（兼容 ethers v5 和 v6）
  let provider;
  if (ethersLib.providers && ethersLib.providers.JsonRpcProvider) { 
    provider = new ethersLib.providers.JsonRpcProvider(RPC_URL);  // ethers v5
  } else { 
    provider = new ethersLib.JsonRpcProvider(RPC_URL);  // ethers v6
  }
  PROVIDER = provider;
  
  // 初始化签名者
  let signer = null;
  if (ENABLE_ONCHAIN) {
    if (PRIVATE_KEY) {
      // 使用提供的私钥创建签名者
      signer = new ethersLib.Wallet(PRIVATE_KEY, provider);
    } else {
      // 生成临时钱包（用于本地测试）
      try {
        const wallet = ethersLib.Wallet.createRandom().connect(provider);
        try {
          // 尝试为临时钱包充值（仅 Hardhat 支持）
          const fundHex = '0x' + ethersLib.parseEther('1000').toString(16);
          await provider.send('hardhat_setBalance', [wallet.address, fundHex]);
        } catch (e) {
          console.log(`无法调用 hardhat_setBalance: ${e?.message || e}`);
        }
        signer = wallet;
      } catch (e) {
        console.log(`✗ 生成临时钱包失败: ${e?.message || e}`);
      }
    }
  }
  RESOLVED_SIGNER = signer;
  if (RESOLVED_SIGNER) {
    try { console.log(`使用签名者: ${RESOLVED_SIGNER.address || await RESOLVED_SIGNER.getAddress()}`); } catch {}
  }
  
  // 获取或自动检测 RevenueManager 合约地址
  if (!RESOLVED_CONTRACT_ADDRESS) {
    try { RESOLVED_CONTRACT_ADDRESS = await autoDetectContractAddress(provider); } catch {}
  }
  if (RESOLVED_CONTRACT_ADDRESS) { 
    console.log(`RevenueManager 合约地址: ${RESOLVED_CONTRACT_ADDRESS}`); 
  } else { 
    console.log(`未能确定合约地址，可设置环境变量 ADAPTER_CONTRACT`); 
  }
  
  // 检查 Adapter 服务是否运行
  try {
    await axios.get(`${ADAPTER_URL}/health`);
    console.log(`✓ Adapter服务已开启`);
  } catch (error) {
    console.log(`✗ 无法连接到Adapter服务: ${error.message}`);
    console.log(`请先启动Adapter服务: npm start`);
  }
  
  // 立即执行一次更新
  await runUpdateCycle();
  
  // 设置定时器，每隔 UPDATE_INTERVAL 毫秒执行一次更新
  const intervalId = setInterval(runUpdateCycle, UPDATE_INTERVAL);
  
  // 设置信号处理：按 CTRL+C 时清理并退出
  process.on('SIGINT', () => {
    clearInterval(intervalId);  // 清除定时器
    console.log('\n自动更新服务已停止');
    process.exit(0);  // 退出进程
  });
  
  console.log('\n按 CTRL+C 退出');
}

startRealTimeUpdater();
