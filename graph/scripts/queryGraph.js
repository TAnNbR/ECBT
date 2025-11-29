const axios = require('axios');

const SUBGRAPH_URL = 'http://localhost:8000/subgraphs/name/orderbook';

async function query(gql) {
  const response = await axios.post(SUBGRAPH_URL, { query: gql });
  return response.data;
}

async function main() {
  console.log('=== Global Stats ===');
  const stats = await query(`{
    globalStats(id: "global") {
      totalOrders
      totalActiveOrders
      totalFilledOrders
      totalCancelledOrders
      totalVolume
      totalFills
      uniqueUsers
    }
  }`);
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n=== Recent Orders ===');
  const orders = await query(`{
    orders(first: 5, orderBy: createdAt, orderDirection: desc) {
      id
      orderId
      status
      sellerAddress
      amount
      price
      filledAmount
      remainingAmount
    }
  }`);
  console.log(JSON.stringify(orders, null, 2));

  console.log('\n=== Recent Fills ===');
  const fills = await query(`{
    orderFills(first: 5, orderBy: timestamp, orderDirection: desc) {
      id
      orderId
      buyerAddress
      filledAmount
      totalPayment
      timestamp
    }
  }`);
  console.log(JSON.stringify(fills, null, 2));

  console.log('\n=== Users ===');
  const users = await query(`{
    users(first: 5) {
      id
      totalOrdersCreated
      totalOrdersFilled
      totalOrdersCancelled
      totalVolumeAssSeller
      totalVolumeAsBuyer
    }
  }`);
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error);

