// mock-api.cjs
// 模拟API服务器 - 每5秒更新一次数据

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8081;

// 中间件
app.use(express.json());
app.use(cors());

// 资产初始值
const assetData = {
  'Hotel': { 
    revenue: 1500000,
    decimals: 6,
    fluctuation: 0.02 // 波动范围 ±2%
  },
  'Meeting_Room': {
    revenue: 2500000,
    decimals: 6,
    fluctuation: 0.03 // 波动范围 ±3%
  },
  'Office': {
    revenue: 500000,
    decimals: 6,
    fluctuation: 0.01 // 波动范围 ±1%
  }
};

// 实时数据 (会被定时更新)
let liveData = JSON.parse(JSON.stringify(assetData));

// 添加随机波动
function addRandomFluctuation() {
  for (const [asset, data] of Object.entries(liveData)) {
    // 生成 -1 到 1 之间的随机数
    const randomFactor = (Math.random() * 2 - 1);
    
    // 基于波动范围计算变化
    const change = data.revenue * data.fluctuation * randomFactor;
    
    // 更新价格
    data.revenue = Math.max(1, Math.round(assetData[asset].revenue + change));
    
    // 更新时间戳
    data.timestamp = Math.floor(Date.now() / 1000);
  }
  
  console.log(`${new Date().toISOString()} | API 数据已更新`);
  logCurrentPrices();
}

// 记录当前价格
function logCurrentPrices() {
  console.log('当前收益数据:');
  for (const [asset, data] of Object.entries(liveData)) {
    console.log(`${asset}: ${data.revenue} (±${data.fluctuation * 100}%)`);
  }
  console.log('----------------------------');
}

// API端点 - 获取单个指定资产收益数据
app.get('/api/revenue/:assetId', (req, res) => {
  const { assetId } = req.params;
  
  if (!liveData[assetId]) {
    return res.status(404).json({ error: '未知资产' });
  }
  
  const { revenue, decimals, timestamp } = liveData[assetId];
  
  res.json({
    assetId,
    revenue,
    decimals,
    timestamp
  });
});

// API端点 - 获取所有资产数据
app.get('/api/revenue', (req, res) => {
  const result = {};
  
  for (const [asset, data] of Object.entries(liveData)) {
    const { revenue, decimals, timestamp } = data;
    result[asset] = { revenue, decimals, timestamp };
  }
  
  res.json(result);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Mock Revenue API listening on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  - GET  http://localhost:${PORT}/api/revenue`);
  console.log(`  - GET  http://localhost:${PORT}/api/revenue/:asset`);
  
  // 初始化数据
  addRandomFluctuation();
  
  // 设置定时器，每5秒更新一次数据
  setInterval(addRandomFluctuation, 5000);
});
