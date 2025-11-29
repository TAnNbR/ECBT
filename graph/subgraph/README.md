# OrderBook Subgraph

这是 OrderBook 合约的 The Graph 子图，用于索引和查询链上订单数据。

## 📦 监听的事件

1. **OrderCreated** - 订单创建事件
2. **OrderFilled** - 订单成交事件
3. **OrderCancelled** - 订单取消事件

## 🗄️ 数据模型

### Order（订单）
- 订单的完整信息
- 包含卖家、数量、价格、状态等
- 关联所有成交记录

### OrderFill（成交记录）
- 每次部分或完全成交的记录
- 包含买家、成交量、支付金额等

### OrderCancellation（取消记录）
- 订单取消的记录
- 包含退还金额和时间戳

### User（用户）
- 用户统计信息
- 包含创建订单数、成交量等

### GlobalStats（全局统计）
- 整个市场的统计数据
- 包含总订单数、总交易量等

## 🚀 部署状态

- **部署地址**: http://localhost:8000/subgraphs/name/orderbook
- **GraphQL 端点**: http://localhost:8000/subgraphs/name/orderbook
- **Graph Node**: http://localhost:8020
- **IPFS**: http://localhost:5001

## 📝 查询示例

### 查询全局统计

```graphql
{
  globalStats(id: "global") {
    totalOrders
    totalActiveOrders
    totalFilledOrders
    totalCancelledOrders
    totalVolume
    totalFills
    uniqueUsers
  }
}
```

### 查询活跃订单

```graphql
{
  orders(
    first: 10
    orderBy: createdAt
    orderDirection: desc
    where: { status: Active }
  ) {
    id
    orderId
    sellerAddress
    amount
    price
    filledAmount
    remainingAmount
    status
  }
}
```

### 查询用户信息

```graphql
{
  user(id: "0x...") {
    address
    totalOrdersCreated
    totalOrdersFilled
    totalVolumeAssSeller
    totalVolumeAsBuyer
    ordersCreated(first: 10) {
      orderId
      amount
      price
      status
    }
  }
}
```

### 查询最近成交

```graphql
{
  orderFills(first: 20, orderBy: timestamp, orderDirection: desc) {
    orderId
    buyerAddress
    filledAmount
    totalPayment
    timestamp
    order {
      sellerAddress
      price
    }
  }
}
```

更多查询示例请参考 `queries.graphql` 文件。

## 🛠️ 开发命令

```bash
# 生成代码
cd subgraph
npx graph codegen

# 构建
npx graph build

# 部署到本地
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.1 orderbook
```

## 🧪 测试

### 使用测试脚本

```bash
# 在项目根目录运行
node test-subgraph.js

# 监听新订单
node test-subgraph.js watch
```

### 使用 curl

```bash
# 查询全局统计
curl -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ globalStats(id: \"global\") { totalOrders totalActiveOrders } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

### 使用 GraphQL Playground

访问 GraphQL Playground 进行交互式查询：

http://localhost:8000/subgraphs/name/orderbook/graphql

## 📊 数据同步

Subgraph 会自动从区块链同步数据：

1. **实时同步**: Graph Node 会监听新区块并处理相关事件
2. **历史数据**: 从 `startBlock: 0` 开始索引所有历史数据
3. **延迟**: 通常只有几秒钟的延迟

### 检查同步状态

```bash
# 查看 Graph Node 日志
docker-compose logs -f graph-node

# 或使用脚本
npm run graph:logs
```

## 🔍 故障排查

### Subgraph 未同步

如果查询返回 "has not started syncing yet" 错误：

1. 确保 Hardhat node 正在运行并有数据
2. 等待几秒让 Graph Node 索引区块
3. 检查 Graph Node 日志查看错误

### 重新部署

```bash
cd subgraph

# 重新构建和部署
npx graph build
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.2 orderbook
```

### 完全重置

```bash
# 删除 subgraph
npx graph remove --node http://localhost:8020/ orderbook

# 重新创建和部署
npx graph create --node http://localhost:8020/ orderbook
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.1 orderbook
```

## 📁 文件结构

```
subgraph/
├── schema.graphql          # GraphQL 数据模型定义
├── subgraph.yaml          # Subgraph 配置文件
├── src/
│   └── mapping.ts         # 事件处理逻辑
├── abis/
│   └── OrderBook.json     # 合约 ABI
├── queries.graphql        # 查询示例集合
├── package.json           # 依赖和脚本
└── generated/             # 生成的代码（自动生成）
```

## 🔗 相关资源

- [The Graph 文档](https://thegraph.com/docs/)
- [AssemblyScript API](https://thegraph.com/docs/en/developing/assemblyscript-api/)
- [GraphQL 查询语法](https://graphql.org/learn/queries/)

## 📄 合约地址

- OrderBook: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- Network: localhost (chainId: 31337)

