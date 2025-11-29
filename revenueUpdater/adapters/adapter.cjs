const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

/**
 * External Adapter for Revenue Oracle
 * 
 * 功能：从外部API获取收益数据，并转换为18位精度格式
 * 
 * 输入参数：
 * - assetId: 资产ID
 * 
 * 输出：
 * - periodRevenue: 周期收益金额（18位精度）
 * - timestamp: 时间戳
 */

// 从真实API获取数据
async function fetchRevenueFromExternalAPI(assetId) {
  try {
    const apiUrl = process.env.REVENUE_API_URL || 'http://localhost:8081';
    console.log(`Fetching data for ${assetId} from ${apiUrl}/api/revenue/${assetId}`);
    
    // 尝试从实际API获取数据
    try {
      const response = await axios.get(`${apiUrl}/api/revenue/${assetId}`, {
        timeout: 3000 // 3秒超时
      });
      
      // 验证API响应
      if (response.data && response.data.revenue !== undefined) {
        console.log(`API return revenue data: ${assetId} = ${response.data.revenue}`);
        return {
          revenue: response.data.revenue,
          decimals: response.data.decimals || 6,
          timestamp: response.data.timestamp || Math.floor(Date.now() / 1000)
        };
      }
    } catch (apiError) {
      console.warn(`API request failed: ${apiError.message}`);
    }
  } catch (error) {
    console.error('API link Error:', error.message);
    throw new Error(`Failed to fetch revenue data: ${error.message}`);
  }
}

/**
 * 转换收益数据为18位精度格式
 */
function convertToPrecision(revenue, decimals) {
  // 转换为18位精度
  const revenueWith18Decimals = BigInt(revenue) * BigInt(10 ** (18 - decimals));
  
  return revenueWith18Decimals.toString();
}

/**
 * 主要的Adapter端点
 * 更新器节点会POST请求到这个端点
 */
app.post('/', async (req, res) => {
  try {
    console.log('Received request:', JSON.stringify(req.body, null, 2));

    // 验证请求格式
    if (!req.body.data) {
      return res.status(400).json({
        jobRunID: req.body.id || '1',
        status: 'errored',
        error: 'Missing data in request body'
      });
    }

    const { assetId } = req.body.data;

    // 验证必要参数
    if (!assetId) {
      return res.status(400).json({
        jobRunID: req.body.id || '1',
        status: 'errored',
        error: 'Missing required parameters: assetId'
      });
    }

    // 从外部API获取数据
    const apiData = await fetchRevenueFromExternalAPI(assetId);

    // 转换为18位精度
    const periodRevenue = convertToPrecision(
      apiData.revenue,
      apiData.decimals
    );

    // 返回响应
    res.json({
      jobRunID: req.body.id || '1',
      data: {
        result: periodRevenue,
        periodRevenue: periodRevenue,
        timestamp: apiData.timestamp
      },
      status: 'completed',
      statusCode: 200
    });

    console.log('Response sent successfully');
  } catch (error) {
    console.error('Adapter Error:', error);
    res.status(500).json({
      jobRunID: req.body.id || '1',
      status: 'errored',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * 健康检查端点 - get
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * 测试端点 - post
 */
app.post('/test', async (req, res) => {
  try {
    const testData = {
      id: '1',
      data: {
        assetId: 'BTC'
      }
    };

    console.log('Test request:', testData);

    // 模拟API响应（用于测试）
    const mockApiData = {
      revenue: 1500000,  // 1.5 USDC
      decimals: 6,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const periodRevenue = convertToPrecision(
      mockApiData.revenue,
      mockApiData.decimals
    );

    res.json({
      jobRunID: testData.id,
      data: {
        result: periodRevenue,
        periodRevenue: periodRevenue,
        timestamp: mockApiData.timestamp
      },
      status: 'completed',
      statusCode: 200
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      statusCode: 500
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Revenue Oracle Adapter listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test endpoint: POST http://localhost:${PORT}/test`);
});
