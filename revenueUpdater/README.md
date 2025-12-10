# 💰 Revenue Updater - 自动收益更新服务

## 🚀 一键启动

```bash
cd /home/smx/ECBT/revenueUpdater

# 设置私钥
export PRIVATE_KEY="0x你的私钥"

# 启动所有服务
./start-all.sh
```

## 📋 可用脚本

| 脚本 | 功能 | 用法 |
|------|------|------|
| `start-all.sh` | 一键启动所有服务 | `./start-all.sh` |
| `stop-all.sh` | 停止所有服务 | `./stop-all.sh` |
| `check-status.sh` | 检查服务状态 | `./check-status.sh` |
| `start-updater.sh` | 仅启动 Updater | `./start-updater.sh` |
| `setup-sepolia.sh` | 配置向导 | `./setup-sepolia.sh` |

## 🎯 服务架构

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Mock API   │ -->  │   Adapter   │ -->  │   Updater   │ -->  │   Sepolia    │
│   :8081     │      │    :8080    │      │             │      │ RevenueManager│
└─────────────┘      └─────────────┘      └─────────────┘      └──────────────┘
    生成数据            转换精度          发送交易            记录收益
    6位精度            6位精度           每5秒                6位精度
```

## 📝 详细使用说明

### 1. 启动所有服务

```bash
# 方法 1: 使用一键脚本（推荐）
export PRIVATE_KEY="0x..."
./start-all.sh

# 方法 2: 使用 npm 脚本
export PRIVATE_KEY="0x..."
npm run start:all
```

**脚本会自动：**
1. ✅ 检查配置文件
2. ✅ 安装依赖（如需要）
3. ✅ 停止旧服务
4. ✅ 启动 Mock API (端口 8081)
5. ✅ 启动 Adapter (端口 8080)
6. ✅ 启动 Updater (连接 Sepolia)
7. ✅ 验证所有服务正常运行

### 2. 检查服务状态

```bash
./check-status.sh
```

**显示内容：**
- 进程运行状态（PID）
- 端点响应测试
- 最新日志（最后5行）
- 更新统计信息
- 最新交易链接

### 3. 停止所有服务

```bash
./stop-all.sh
```

### 4. 查看实时日志

```bash
# Mock API 日志
tail -f mockapi.log

# Adapter 日志
tail -f adapter.log

# Updater 日志
tail -f updater.log
```

## 🔧 配置说明

### 环境变量

必需：
- `PRIVATE_KEY` - 部署者私钥（用于发送交易）

可选：
- `UPDATE_INTERVAL` - 更新间隔（毫秒，默认 5000）
- `ENABLE_ONCHAIN` - 是否启用链上更新（默认 true）

### config.sepolia.json

```json
{
  "network": "sepolia",
  "rpcUrl": "https://eth-sepolia.g.alchemy.com/v2/...",
  "contracts": {
    "revenueManager": "0x...",
    "assetToken": "0x...",
    "collateralVault": "0x...",
    "mockERC20": "0x..."
  },
  "settings": {
    "enableOnchain": true,
    "updateInterval": 5000,
    "assetId": "RealEstate"
  }
}
```

## 📊 服务详情

### Mock API (端口 8081)

**功能**: 生成模拟收益数据

**端点**:
```bash
# 获取资产收益
curl http://localhost:8081/api/revenue/RealEstate

# 响应示例
{
  "assetId": "RealEstate",
  "revenue": 1010988,
  "decimals": 6,
  "timestamp": 1765382265
}
```

### Adapter (端口 8080)

**功能**: 转换数据格式，输出 6 位精度

**端点**:
```bash
# 处理数据请求
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"id":"test","data":{"assetId":"RealEstate"}}'

# 健康检查
curl http://localhost:8080/health
```

### Updater

**功能**: 自动将收益数据更新到 Sepolia RevenueManager

**配置**:
- 更新间隔: 5 秒
- 网络: Sepolia (Chain ID 11155111)
- 精度: 6 位（USDT）

**输出**: 每次更新会显示
- 从 Adapter 获取的收益数据
- 发送的交易哈希
- 区块号和 Gas 使用
- Etherscan 链接
- 当前累计总收益

## 🐛 故障排除

### 服务无法启动

```bash
# 检查端口占用
lsof -i :8080
lsof -i :8081

# 强制停止
pkill -9 -f "node adapters"

# 重新启动
./start-all.sh
```

### 交易失败

1. 检查钱包余额（需要 ETH 支付 gas）
2. 检查私钥是否正确
3. 检查 RPC 连接
4. 查看详细日志: `cat updater.log`

### 数据不更新

```bash
# 测试 Mock API
curl http://localhost:8081/api/revenue/RealEstate

# 测试 Adapter
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"id":"test","data":{"assetId":"RealEstate"}}'

# 检查 Updater 日志
tail -50 updater.log
```

## 📈 监控

### 查看累计收益

```bash
cd /home/smx/ECBT
npx hardhat console --network sepolia

# 在 console 中：
const rm = await ethers.getContractAt("RevenueManager", "0x327C7dc5071E77aBe5df5Bf8FA3c82045E1294be")
const revenue = await rm.lastestAccumulatedRevenue()
console.log("累计收益:", ethers.formatUnits(revenue, 6), "USDT")
```

### Etherscan

**RevenueManager 合约**:
```
https://sepolia.etherscan.io/address/0x327C7dc5071E77aBe5df5Bf8FA3c82045E1294be
```

查看所有 `recordPeriodRevenue` 交易。

## 🎉 快速命令

```bash
# 启动
export PRIVATE_KEY="0x..."
./start-all.sh

# 状态
./check-status.sh

# 停止
./stop-all.sh

# 查看日志
tail -f updater.log
```

## ✅ 成功指标

服务正常运行时，你会看到：

1. ✅ 3个进程在运行
2. ✅ Mock API 响应正常
3. ✅ Adapter 响应正常
4. ✅ Updater 日志显示成功交易
5. ✅ Etherscan 显示新交易
6. ✅ 前端显示累计收益增长

---

**当前配置**: 所有组件使用 **6 位精度（USDT 标准）** ✅
