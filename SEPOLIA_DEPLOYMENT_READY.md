# Sepolia 部署准备完成

## ✅ 已完成的配置

### 1. Hardhat 配置
- ✅ 更新 `hardhat.config.js` 添加 Sepolia 网络
- ✅ 安装 `dotenv` 依赖
- ✅ 创建 `.env.example` 模板文件

### 2. 部署脚本
- ✅ `scripts/deploy-sepolia.js` - Sepolia 专用部署脚本
- ✅ 自动配置所有合约
- ✅ 生成 `deployment-info-sepolia.json`

### 3. 前端配置
- ✅ `frontend/setup-env-sepolia.sh` - 自动生成前端配置
- ✅ 支持 Sepolia 网络 (Chain ID: 11155111)

### 4. 文档
- ✅ `docs/DEPLOY_TO_SEPOLIA.md` - 详细部署指南
- ✅ `docs/QUICK_DEPLOY_SEPOLIA.md` - 快速部署指南

## 🚀 部署到 Sepolia 的步骤

### 准备工作 (首次部署)

1. **获取 Sepolia ETH**
   ```
   访问水龙头: https://www.alchemy.com/faucets/ethereum-sepolia
   至少获取: 0.5 ETH
   ```

2. **获取 RPC URL**
   - 注册 Alchemy: https://www.alchemy.com/
   - 创建 Sepolia 应用
   - 复制 API URL

3. **准备私钥**
   - 从 MetaMask 导出测试钱包私钥
   - ⚠️ 仅用于测试，不要用于主网

4. **创建 .env 文件**
   ```bash
   cp .env.example .env
   ```
   
   编辑 `.env` 填入:
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
   PRIVATE_KEY=your_private_key_without_0x
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

### 执行部署

```bash
# 在项目根目录
cd /home/smx/ECBT

# 部署到 Sepolia
npx hardhat run scripts/deploy-sepolia.js --network sepolia
```

### 部署后操作

1. **验证合约**
   ```bash
   # 自动从 deployment-info-sepolia.json 读取地址
   npx hardhat verify --network sepolia <ADDRESS>
   ```

2. **配置前端**
   ```bash
   cd frontend
   ./setup-env-sepolia.sh
   # 编辑 .env.local 填入 RPC URL
   npm run dev
   ```

3. **测试**
   - 在浏览器打开 http://localhost:3000
   - 连接 MetaMask 到 Sepolia 网络
   - 测试购买、交易等功能

## 📁 生成的文件

部署后会生成以下文件：

```
ECBT/
├── .env                              # ⚠️ 不要提交到 Git
├── deployment-info-sepolia.json      # Sepolia 部署信息
└── frontend/
    └── .env.local                    # ⚠️ 不要提交到 Git
```

## 💰 预计费用

| 项目 | 费用 (Sepolia ETH) |
|------|-------------------|
| 合约部署 | ~0.15-0.20 |
| 合约初始化 | ~0.04-0.06 |
| **总计** | **~0.20-0.30** |

## 🔗 有用的链接

| 服务 | 链接 |
|------|------|
| Sepolia 浏览器 | https://sepolia.etherscan.io/ |
| Alchemy 控制台 | https://dashboard.alchemy.com/ |
| Sepolia 水龙头 | https://www.alchemy.com/faucets/ethereum-sepolia |
| Etherscan API | https://etherscan.io/myapikey |

## ⚠️ 安全提醒

- ❌ **永远不要**提交 `.env` 文件到 Git
- ❌ **永远不要**在主网使用测试私钥
- ❌ **永远不要**分享您的私钥
- ✅ 使用专门的测试钱包
- ✅ 定期轮换 API Keys

## 📚 文档

- **详细指南**: [docs/DEPLOY_TO_SEPOLIA.md](./docs/DEPLOY_TO_SEPOLIA.md)
- **快速开始**: [docs/QUICK_DEPLOY_SEPOLIA.md](./docs/QUICK_DEPLOY_SEPOLIA.md)

## 🆘 需要帮助？

如果遇到问题:
1. 查看 [docs/DEPLOY_TO_SEPOLIA.md](./docs/DEPLOY_TO_SEPOLIA.md) 的"常见问题"部分
2. 检查 Hardhat 日志
3. 在 Sepolia Etherscan 查看交易状态

---

**准备状态**: ✅ 已就绪
**下一步**: 配置 `.env` 文件并执行部署

