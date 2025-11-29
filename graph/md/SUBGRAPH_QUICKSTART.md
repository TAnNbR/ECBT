# OrderBook Subgraph 快速开始指南

## 🎉 已完成配置

✅ **Subgraph 已成功部署并正在运行！**

- **GraphQL 端点**: http://localhost:8000/subgraphs/name/orderbook
- **Graph Node 管理**: http://localhost:8020
- **GraphQL Playground**: http://localhost:8000/subgraphs/name/orderbook/graphql

## 📊 当前同步状态

Subgraph 已成功索引链上数据：
- ✅ 已捕获 OrderCreated 事件
- ✅ 已捕获 OrderFilled 事件  
- ✅ 已捕获 OrderCancelled 事件

## 🚀 快速查询示例

### 1. 查询全局统计

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ globalStats(id: \"global\") { totalOrders totalActiveOrders totalFilledOrders totalCancelledOrders totalVolume totalFills uniqueUsers } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

### 2. 查询最近的订单

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ orders(first: 10, orderBy: createdAt, orderDirection: desc) { id orderId status sellerAddress amount price filledAmount remainingAmount } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

### 3. 查询活跃订单

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ orders(where: { status: Active }, first: 10) { id orderId sellerAddress amount price filledAmount remainingAmount } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

### 4. 查询成交记录

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ orderFills(first: 10, orderBy: timestamp, orderDirection: desc) { id orderId buyerAddress filledAmount totalPayment timestamp } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

### 5. 查询用户信息

```bash
# 替换 USER_ADDRESS 为实际地址（小写）
curl -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ user(id: \"USER_ADDRESS\") { address totalOrdersCreated totalOrdersFilled totalOrdersCancelled totalVolumeAssSeller totalVolumeAsBuyer } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

## 🌐 使用 GraphQL Playground

访问交互式查询界面：

http://localhost:8000/subgraphs/name/orderbook/graphql

在 Playground 中尝试这些查询：

```graphql
# 查询订单详情
{
  order(id: "1") {
    orderId
    sellerAddress
    amount
    price
    filledAmount
    status
    fills {
      buyerAddress
      filledAmount
      totalPayment
      timestamp
    }
    cancellation {
      refundedAmount
      timestamp
    }
  }
}
```

## 📁 项目结构

```
/home/smx/ECBT/test/
├── subgraph/                    # Subgraph 项目
│   ├── schema.graphql          # 数据模型定义
│   ├── subgraph.yaml           # Subgraph 配置
│   ├── src/mapping.ts          # 事件处理逻辑
│   ├── abis/OrderBook.json     # 合约 ABI
│   ├── queries.graphql         # 查询示例集合
│   ├── README.md               # 详细文档
│   └── generated/              # 自动生成的代码
├── test-subgraph.js            # Node.js 测试脚本
├── docker-compose.yml          # Graph 服务配置
├── start-graph.sh              # 启动 Graph 服务
├── stop-graph.sh               # 停止 Graph 服务
└── check-graph-health.sh       # 健康检查脚本
```

## 🛠️ 常用命令

### 管理 Graph 服务

```bash
# 启动 Graph Node
./start-graph.sh

# 停止 Graph Node
./stop-graph.sh

# 检查服务健康
./check-graph-health.sh

# 查看日志
docker-compose logs -f graph-node
```

### 管理 Subgraph

```bash
cd subgraph

# 生成代码（修改 schema 或 ABI 后）
npx graph codegen

# 构建
npx graph build

# 部署（需要递增版本号）
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.2 orderbook
```

### 测试和监控

```bash
# 运行测试脚本
node test-subgraph.js

# 监听新订单
node test-subgraph.js watch

# 检查同步状态
curl -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ _meta { block { number } } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

## 📊 数据模型说明

### Order（订单实体）
- 记录每个订单的完整信息
- 跟踪订单状态变化（Active/Filled/Cancelled）
- 关联所有成交记录

### OrderFill（成交记录）
- 记录每次部分或完全成交
- 包含买家、成交量、支付金额
- 不可变实体（immutable）

### OrderCancellation（取消记录）
- 记录订单取消事件
- 包含退还金额和时间
- 不可变实体（immutable）

### User（用户统计）
- 汇总用户的交易活动
- 包含创建/成交/取消订单数量
- 包含买卖双方的交易量

### GlobalStats（全局统计）
- 整个市场的汇总数据
- 实时更新各项指标
- 单例实体（id: "global"）

## 🔍 高级查询示例

### 查询特定用户的完整信息

```graphql
{
  user(id: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8") {
    address
    totalOrdersCreated
    totalOrdersFilled
    ordersCreated(first: 10, orderBy: createdAt, orderDirection: desc) {
      orderId
      amount
      price
      status
      filledAmount
      fills {
        buyerAddress
        filledAmount
        timestamp
      }
    }
    fills(first: 10) {
      orderId
      filledAmount
      totalPayment
      timestamp
    }
  }
}
```

### 按交易量排序的用户

```graphql
{
  users(
    first: 10
    orderBy: totalVolumeAssSeller
    orderDirection: desc
  ) {
    address
    totalOrdersCreated
    totalVolumeAssSeller
    totalVolumeAsBuyer
  }
}
```

### 大额订单查询

```graphql
{
  orders(
    where: { 
      amount_gte: "100000000000000000000"
      status: Active
    }
    orderBy: amount
    orderDirection: desc
  ) {
    orderId
    sellerAddress
    amount
    price
    remainingAmount
  }
}
```

## 🐛 故障排查

### Subgraph 未同步

如果查询返回错误：

1. **检查 Hardhat node 是否运行**
```bash
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

2. **检查 Graph Node 日志**
```bash
docker-compose logs -f graph-node
```

3. **等待同步完成**
   - 新部署的 subgraph 需要几秒到几分钟同步历史数据

### 重新部署 Subgraph

如果需要更新 subgraph：

```bash
cd subgraph

# 修改代码后重新生成
npx graph codegen

# 构建
npx graph build

# 部署新版本
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.3 orderbook
```

## 📚 相关文档

- 详细文档: `subgraph/README.md`
- 查询示例: `subgraph/queries.graphql`
- Graph 配置: `GRAPH_SETUP.md`
- 测试脚本: `test-subgraph.js`

## ✅ 验证部署

运行以下命令验证一切正常：

```bash
# 1. 检查服务健康
./check-graph-health.sh

# 2. 测试查询
curl -X POST -H "Content-Type: application/json" \
  --data '{"query": "{ globalStats(id: \"global\") { totalOrders } }"}' \
  http://localhost:8000/subgraphs/name/orderbook

# 3. 运行完整测试
node test-subgraph.js
```

## 🎯 下一步

1. 在应用中集成 GraphQL 查询
2. 创建实时订阅（WebSocket）
3. 添加更多查询优化和索引
4. 部署到测试网或主网

---

**🎉 恭喜！您的 OrderBook Subgraph 已成功运行！**

