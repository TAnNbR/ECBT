# 部署到 Sepolia 测试网指南

## 前置要求

### 1. 获取 Sepolia 测试网 ETH
您的钱包需要至少 **0.5 ETH** 用于部署合约。

**Sepolia 水龙头:**
- Alchemy Faucet: https://www.alchemy.com/faucets/ethereum-sepolia
- Sepolia Faucet: https://sepoliafaucet.com/
- Infura Faucet: https://www.infura.io/faucet/sepolia

### 2. 获取 RPC URL
从以下服务商之一获取免费的 Sepolia RPC URL:

**Alchemy (推荐):**
1. 注册: https://www.alchemy.com/
2. 创建新应用 (选择 Ethereum Sepolia)
3. 获取 API Key
4. RPC URL 格式: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

**Infura:**
1. 注册: https://www.infura.io/
2. 创建新项目
3. 获取 Project ID
4. RPC URL 格式: `https://sepolia.infura.io/v3/YOUR-PROJECT-ID`

### 3. 获取 Etherscan API Key (可选，用于合约验证)
1. 注册: https://etherscan.io/register
2. 登录后访问: https://etherscan.io/myapikey
3. 创建新的 API Key

### 4. 准备私钥
从您的钱包导出私钥（确保此钱包只用于测试！）

**MetaMask 导出私钥:**
1. 打开 MetaMask
2. 点击账户 → 账户详情
3. 导出私钥
4. ⚠️ **警告**: 不要分享或提交此私钥到 Git！

## 配置步骤

### 步骤 1: 创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
cd /home/smx/ECBT
cp .env.example .env
```

### 步骤 2: 编辑 .env 文件

填入您的实际配置：

```bash
# Sepolia RPC URL
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# 部署账户私钥 (不要包含 0x 前缀)
PRIVATE_KEY=your_private_key_here

# Etherscan API Key (用于合约验证)
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 步骤 3: 确保 .env 在 .gitignore 中

检查 `.gitignore` 文件，确保包含：

```
.env
.env.local
```

## 部署流程

### 方式 1: 使用专用脚本 (推荐)

```bash
cd /home/smx/ECBT
npx hardhat run scripts/deploy-sepolia.js --network sepolia
```

### 方式 2: 使用通用脚本

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## 部署过程

部署脚本将按以下顺序部署合约：

1. **MockERC20 (USDT)** - 测试用稳定币
2. **CollateralVault** - 抵押金库
3. **RevenueManager** - 收益管理器
4. **LiquidateManager** - 清算管理器
5. **OrderBook** - 订单簿
6. **AssetToken** - 资产代币（主合约）

### 预计 Gas 费用

每个合约的预计 Gas 费用（以 Sepolia ETH 计算）：

| 合约 | 预计 Gas | 备注 |
|------|----------|------|
| MockERC20 | ~0.01 ETH | 简单合约 |
| CollateralVault | ~0.02 ETH | |
| RevenueManager | ~0.03 ETH | 包含复杂逻辑 |
| LiquidateManager | ~0.02 ETH | |
| OrderBook | ~0.03 ETH | |
| AssetToken | ~0.05 ETH | 最复杂的合约 |
| 初始化和配置 | ~0.04 ETH | |
| **总计** | **~0.20 ETH** | 实际可能更低 |

## 部署后

### 1. 验证部署信息

部署完成后，检查生成的文件：

```bash
cat deployment-info-sepolia.json
```

### 2. 验证合约 (推荐)

在 Etherscan 上验证合约，使其可读：

```bash
# 验证 AssetToken
npx hardhat verify --network sepolia <ASSET_TOKEN_ADDRESS>

# 验证 CollateralVault
npx hardhat verify --network sepolia <COLLATERAL_VAULT_ADDRESS> <PAYMENT_TOKEN_ADDRESS>

# 验证 OrderBook
npx hardhat verify --network sepolia <ORDER_BOOK_ADDRESS> <FEE_COLLECTOR> <FEE_RATE>
```

或使用自动验证脚本（即将创建）。

### 3. 查看合约

在 Sepolia Etherscan 查看您的合约：

```
https://sepolia.etherscan.io/address/<YOUR_CONTRACT_ADDRESS>
```

### 4. 更新前端配置

更新 `frontend/.env.local`:

```bash
cd frontend
./setup-env-sepolia.sh
```

或手动更新：

```env
# Sepolia 测试网配置
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# 从 deployment-info-sepolia.json 复制地址
NEXT_PUBLIC_ASSET_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=0x...
NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_LIQUIDATE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_ORDER_BOOK_ADDRESS=0x...
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=0x...

# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### 5. 测试前端连接

启动前端：

```bash
cd frontend
npm run dev
```

访问 http://localhost:3000 并连接到 Sepolia 网络。

## 常见问题

### Q: 部署失败，提示 "insufficient funds"
**A:** 您的钱包 ETH 不足。从水龙头获取更多 Sepolia ETH。

### Q: 部署失败，提示 "network error"
**A:** 
- 检查 RPC URL 是否正确
- 检查网络连接
- 尝试其他 RPC 提供商

### Q: 私钥无效
**A:**
- 确保私钥不包含 `0x` 前缀
- 确保私钥是 64 个字符的十六进制字符串
- 检查是否从正确的账户导出

### Q: 合约验证失败
**A:**
- 确保 ETHERSCAN_API_KEY 正确
- 等待几分钟后重试
- 检查合约是否已经验证过

### Q: 前端无法连接
**A:**
- 确保 MetaMask 连接到 Sepolia 网络
- 确保前端 `.env.local` 配置正确
- 检查合约地址是否正确

## 安全注意事项

⚠️ **重要安全提示:**

1. **永远不要**将 `.env` 文件提交到 Git
2. **永远不要**在生产环境使用测试私钥
3. **永远不要**在主网使用 Sepolia 测试的私钥
4. 使用专门的测试钱包，不要存放真实资金
5. 定期轮换 API Keys
6. 在团队协作时使用环境变量管理工具

## 网络信息

### Sepolia 测试网
- **Chain ID:** 11155111
- **区块浏览器:** https://sepolia.etherscan.io/
- **原生代币:** ETH (测试网)
- **区块时间:** ~12 秒
- **Gas Price:** 动态，通常很低

## 费用估算

Sepolia 测试网的 Gas 价格通常很低，但实际费用取决于网络拥堵情况：

- **低拥堵:** 部署成本约 0.15-0.20 ETH
- **中等拥堵:** 部署成本约 0.20-0.30 ETH
- **高拥堵:** 部署成本约 0.30-0.50 ETH

建议在钱包中至少保留 **0.5 ETH** 以确保成功部署。

## 下一步

部署到 Sepolia 后：

1. ✅ 在 Sepolia Etherscan 上验证所有合约
2. ✅ 测试前端与 Sepolia 合约的交互
3. ✅ 邀请测试用户使用应用
4. ✅ 收集反馈和错误报告
5. ✅ 优化和修复问题
6. 🚀 准备主网部署

## 相关链接

- **Sepolia Etherscan:** https://sepolia.etherscan.io/
- **Alchemy Dashboard:** https://dashboard.alchemy.com/
- **Hardhat 文档:** https://hardhat.org/
- **OpenZeppelin 文档:** https://docs.openzeppelin.com/

---

**最后更新:** 2025-12-08
**网络:** Sepolia Testnet
**Chain ID:** 11155111

