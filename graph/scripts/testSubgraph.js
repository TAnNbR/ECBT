const axios = require('axios');

const SUBGRAPH_URL = 'http://localhost:8000/subgraphs/name/orderbook';

// GraphQL 查询函数
async function query(gql) {
  try {
    const response = await axios.post(SUBGRAPH_URL, {
      query: gql
    });
    return response.data;
  } catch (error) {
    console.error('Query error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

// 测试函数
async function testSubgraph() {
  console.log('=== Testing OrderBook Subgraph ===\n');

  // 1. 查询全局统计
  console.log('1. Querying Global Stats...');
  const statsQuery = `{
    globalStats(id: "global") {
      totalOrders
      totalActiveOrders
      totalFilledOrders
      totalCancelledOrders
      totalVolume
      totalFills
      uniqueUsers
    }
  }`;
  const stats = await query(statsQuery);
  console.log('Global Stats:', JSON.stringify(stats, null, 2));
  console.log('');

  // 2. 查询活跃订单
  console.log('2. Querying Active Orders...');
  const ordersQuery = `{
    orders(first: 5, orderBy: createdAt, orderDirection: desc) {
      id
      orderId
      sellerAddress
      amount
      price
      filledAmount
      status
      createdAt
    }
  }`;
  const orders = await query(ordersQuery);
  console.log('Recent Orders:', JSON.stringify(orders, null, 2));
  console.log('');

  // 3. 查询最近成交
  console.log('3. Querying Recent Fills...');
  const fillsQuery = `{
    orderFills(first: 5, orderBy: timestamp, orderDirection: desc) {
      id
      orderId
      buyerAddress
      filledAmount
      totalPayment
      timestamp
    }
  }`;
  const fills = await query(fillsQuery);
  console.log('Recent Fills:', JSON.stringify(fills, null, 2));
  console.log('');

  // 4. 查询用户列表
  console.log('4. Querying Users...');
  const usersQuery = `{
    users(first: 5) {
      id
      address
      totalOrdersCreated
      totalOrdersFilled
      totalOrdersCancelled
      totalVolumeAssSeller
      totalVolumeAsBuyer
    }
  }`;
  const users = await query(usersQuery);
  console.log('Users:', JSON.stringify(users, null, 2));
  console.log('');

  console.log('=== Test Complete ===');
}

// 实时监听新事件（简单示例）
async function watchOrders() {
  console.log('=== Watching for new orders... (Press Ctrl+C to stop) ===\n');
  
  let lastOrderCount = 0;
  
  setInterval(async () => {
    const statsQuery = `{
      globalStats(id: "global") {
        totalOrders
        totalActiveOrders
        totalFills
      }
    }`;
    
    const result = await query(statsQuery);
    if (result && result.data && result.data.globalStats) {
      const stats = result.data.globalStats;
      const currentOrderCount = parseInt(stats.totalOrders);
      
      if (currentOrderCount > lastOrderCount) {
        console.log(`[${new Date().toLocaleTimeString()}] New order detected!`);
        console.log(`  Total Orders: ${stats.totalOrders}`);
        console.log(`  Active Orders: ${stats.totalActiveOrders}`);
        console.log(`  Total Fills: ${stats.totalFills}`);
        console.log('');
        lastOrderCount = currentOrderCount;
      }
    }
  }, 3000);
}

// 命令行参数处理
const command = process.argv[2];

if (command === 'watch') {
  watchOrders();
} else {
  testSubgraph().catch(console.error);
}

