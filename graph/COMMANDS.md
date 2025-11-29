# OrderBook 服务命令手册

## 启动服务

### 1. 启动 Hardhat 节点
```bash
cd /home/smx/ECBT/test
npx hardhat node --hostname 0.0.0.0 > /dev/null 2>&1 &
```

### 2. 部署合约并测试
```bash
cd /home/smx/ECBT/test
npx hardhat run scripts/testOrderbook.js --network localhost
```

### 3. 启动 Graph 服务
```bash
cd /home/smx/ECBT/test
docker-compose up -d
```

### 4. 部署 Subgraph
```bash
cd /home/smx/ECBT/test/subgraph
npx graph build
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.1 orderbook
```

### 5. 启动前端
```bash
cd /home/smx/ECBT/test
python3 -m http.server 8080 > /dev/null 2>&1 &
```

## 访问地址

- **Hardhat RPC**: http://localhost:8545
- **Graph GraphQL**: http://localhost:8000/subgraphs/name/orderbook
- **Graph Playground**: http://localhost:8000/subgraphs/name/orderbook/graphql
- **前端界面**: http://localhost:8080/orderbook-ui.html

## 查询数据

### 使用脚本查询
```bash
cd /home/smx/ECBT/test
node query-graph.js
```

### 使用 curl 查询
```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"query": "{ globalStats(id: \"global\") { totalOrders totalActiveOrders } }"}' \
  http://localhost:8000/subgraphs/name/orderbook
```

## 关闭服务

### 1. 关闭 Graph 服务
```bash
cd /home/smx/ECBT/test
docker-compose down
```

### 2. 关闭 Hardhat 节点
```bash
pkill -f "hardhat node"
```

### 3. 关闭前端服务
```bash
pkill -9 -f "python3 -m http.server"
```

### 4. 关闭所有相关进程
```bash
pkill -f "hardhat"
pkill -f "testOrderbook"
pkill -9 -f "python3 -m http.server"
```

## 一键启动（按顺序）

```bash
cd /home/smx/ECBT/test

# 启动 Hardhat
npx hardhat node --hostname 0.0.0.0 > /dev/null 2>&1 &
sleep 3

# 部署合约
npx hardhat run scripts/testOrderbook.js --network localhost &
sleep 10

# 启动 Graph
docker-compose up -d
sleep 15

# 启动前端
python3 -m http.server 8080 > /dev/null 2>&1 &

echo "✅ 所有服务已启动"
echo "前端: http://localhost:8080/orderbook-ui.html"
```

## 一键关闭

```bash
cd /home/smx/ECBT/test

# 关闭 Docker 容器
docker-compose down

# 关闭所有进程
pkill -9 -f "hardhat node"
pkill -9 -f "testOrderbook"
pkill -9 -f "python3 -m http.server"

echo "✅ 所有服务已关闭"
```

## 检查服务状态

```bash
# 检查端口占用
lsof -i :8545  # Hardhat
lsof -i :8000  # Graph
lsof -i :8080  # 前端

# 检查 Docker 容器
docker ps

# 检查进程
ps aux | grep -E "hardhat|http.server" | grep -v grep
```

## 重启 Subgraph（地址变更时）

```bash
cd /home/smx/ECBT/test/subgraph

# 1. 更新 subgraph.yaml 中的合约地址
# 2. 重新构建和部署
npx graph build
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.2 orderbook
```

## 清理数据

```bash
# 清理 Graph 数据（谨慎使用）
cd /home/smx/ECBT/test
docker-compose down
rm -rf data/

# 清理 Hardhat 缓存
rm -rf cache/ artifacts/
```

