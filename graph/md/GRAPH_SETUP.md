# 本地 Graph 服务配置

## 🎉 已完成配置

本地 Graph Node 服务已成功配置并启动！

## 📦 已安装组件

- ✅ Graph Node (v0.41.1)
- ✅ IPFS (Kubo v0.38.2)
- ✅ PostgreSQL 14
- ✅ Graph CLI

## 🚀 服务端点

### Graph Node
- **GraphQL HTTP**: http://localhost:8000
- **GraphQL WebSocket**: ws://localhost:8001
- **Admin API**: http://localhost:8020
- **Index Node**: http://localhost:8030
- **Metrics**: http://localhost:8040

### IPFS
- **API**: http://localhost:5001

### PostgreSQL
- **端口**: 5432 (仅容器内部访问)
- **用户**: graph-node
- **密码**: let-me-in
- **数据库**: graph-node

## 🎮 常用命令

### 启动和停止服务

```bash
# 启动 Graph Node 服务
./start-graph.sh
# 或
npm run graph:start

# 停止 Graph Node 服务
./stop-graph.sh
# 或
npm run graph:stop

# 查看 Graph Node 日志
npm run graph:logs
# 或
docker-compose logs -f graph-node
```

### 管理 Subgraph

```bash
# 创建本地 subgraph
npm run graph:create-local

# 生成代码（从 schema 和 ABI）
npm run graph:codegen

# 构建 subgraph
npm run graph:build

# 部署到本地 Graph Node
npm run graph:deploy-local

# 删除 subgraph
npm run graph:remove-local
```

## 📝 创建 Subgraph 步骤

### 1. 初始化 Subgraph

```bash
# 在项目根目录创建 subgraph 目录
mkdir -p subgraph
cd subgraph

# 初始化 subgraph
npx graph init --from-contract <CONTRACT_ADDRESS> \
  --network localhost \
  --contract-name OrderBook \
  orderbook
```

### 2. 配置 subgraph.yaml

确保 `subgraph.yaml` 中的网络配置正确：

```yaml
dataSources:
  - kind: ethereum/contract
    name: OrderBook
    network: localhost  # 本地网络
    source:
      address: "YOUR_CONTRACT_ADDRESS"
      abi: OrderBook
      startBlock: 0
```

### 3. 部署流程

```bash
# 1. 确保 Hardhat node 在运行
./start-hardhat.sh

# 2. 部署合约（如果还没部署）
npm run deploy

# 3. 启动 Graph Node
./start-graph.sh

# 4. 创建 subgraph（只需执行一次）
npm run graph:create-local

# 5. 生成代码
npm run graph:codegen

# 6. 构建
npm run graph:build

# 7. 部署
npm run graph:deploy-local
```

## 🔍 查询示例

部署成功后，可以访问 GraphQL Playground：

http://localhost:8000/subgraphs/name/orderbook

示例查询：

```graphql
{
  orders(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    seller
    amount
    price
    filled
    cancelled
    timestamp
  }
}
```

## 🛠 故障排查

### 查看服务状态

```bash
docker-compose ps
```

### 查看日志

```bash
# Graph Node 日志
docker-compose logs -f graph-node

# IPFS 日志
docker-compose logs -f ipfs

# PostgreSQL 日志
docker-compose logs -f postgres
```

### 重启服务

```bash
# 完全重启
docker-compose down
./start-graph.sh
```

### 清理数据（谨慎使用）

```bash
# 停止服务
docker-compose down

# 删除所有数据
rm -rf data/

# 重新启动
./start-graph.sh
```

## 📚 常见问题

### 1. Graph Node 无法连接到 Hardhat

**问题**: Graph Node 显示 "unable to fetch genesis for localhost"

**解决**: 
- 确保 Hardhat node 正在运行（`./start-hardhat.sh`）
- 确保 Hardhat 监听 0.0.0.0:8545
- Graph Node 使用 `host.docker.internal:8545` 连接宿主机

### 2. 端口冲突

**问题**: 端口已被占用

**解决**: 
- 修改 `docker-compose.yml` 中的端口映射
- 或停止占用端口的服务

### 3. Subgraph 部署失败

**问题**: 部署时出现错误

**解决**:
- 检查合约地址是否正确
- 确保 ABI 文件是最新的
- 查看 Graph Node 日志了解详细错误

## 🔗 有用的链接

- [The Graph 文档](https://thegraph.com/docs/)
- [Graph Node GitHub](https://github.com/graphprotocol/graph-node)
- [Graph CLI 文档](https://www.npmjs.com/package/@graphprotocol/graph-cli)
- [GraphQL 查询语法](https://graphql.org/learn/queries/)

## 📊 数据持久化

数据存储在 `./data/` 目录下：
- `./data/ipfs/` - IPFS 数据
- `./data/postgres/` - PostgreSQL 数据库

停止服务时数据会保留，除非手动删除 `data/` 目录。

