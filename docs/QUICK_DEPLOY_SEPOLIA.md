# 快速部署到 Sepolia

## 5 步快速部署

### 1️⃣ 获取 Sepolia ETH
```
访问: https://www.alchemy.com/faucets/ethereum-sepolia
需要: 至少 0.5 ETH
```

### 2️⃣ 配置环境变量
```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 文件，填入:
# - SEPOLIA_RPC_URL (从 Alchemy/Infura 获取)
# - PRIVATE_KEY (您的测试钱包私钥，不带 0x)
# - ETHERSCAN_API_KEY (可选，用于验证)
nano .env
```

### 3️⃣ 部署合约
```bash
npx hardhat run scripts/deploy-sepolia.js --network sepolia
```

### 4️⃣ 验证合约 (可选但推荐)
```bash
# 获取 AssetToken 地址从 deployment-info-sepolia.json
npx hardhat verify --network sepolia <ASSET_TOKEN_ADDRESS>
```

### 5️⃣ 配置前端
```bash
cd frontend
./setup-env-sepolia.sh
# 手动编辑 .env.local 填入 RPC URL 和 WalletConnect ID
npm run dev
```

## 检查清单

- [ ] 钱包有足够的 Sepolia ETH (≥ 0.5 ETH)
- [ ] `.env` 文件配置正确
- [ ] RPC URL 有效
- [ ] 私钥正确（64 字符，不带 0x）
- [ ] 合约部署成功
- [ ] `deployment-info-sepolia.json` 已生成
- [ ] 合约在 Etherscan 上验证
- [ ] 前端 `.env.local` 已配置
- [ ] 前端可以连接到 Sepolia 合约

## 常用命令

```bash
# 部署到 Sepolia
npx hardhat run scripts/deploy-sepolia.js --network sepolia

# 检查部署的合约
cat deployment-info-sepolia.json

# 验证单个合约
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> [CONSTRUCTOR_ARGS...]

# 查看账户余额
npx hardhat run scripts/check-balance.js --network sepolia

# 前端配置
cd frontend && ./setup-env-sepolia.sh
```

## 获取资源

| 资源 | 链接 |
|------|------|
| Sepolia 水龙头 (Alchemy) | https://www.alchemy.com/faucets/ethereum-sepolia |
| Sepolia 水龙头 (备用) | https://sepoliafaucet.com/ |
| Alchemy Dashboard | https://dashboard.alchemy.com/ |
| Etherscan API Key | https://etherscan.io/myapikey |
| WalletConnect Cloud | https://cloud.walletconnect.com/ |
| Sepolia Etherscan | https://sepolia.etherscan.io/ |

## 预计时间和成本

- ⏱️ **部署时间:** 5-10 分钟
- 💰 **Gas 费用:** ~0.15-0.25 Sepolia ETH
- 📝 **验证时间:** 1-2 分钟/合约

## 故障排除

### 部署失败
```bash
# 检查余额
npx hardhat run scripts/check-balance.js --network sepolia

# 测试连接
npx hardhat console --network sepolia
> await ethers.provider.getBlockNumber()
```

### RPC 错误
- 更换 RPC 提供商
- 检查 API Key 是否正确
- 确认 RPC URL 格式正确

### 前端无法连接
- 在 MetaMask 中添加 Sepolia 网络
- 确认合约地址正确
- 检查浏览器控制台错误

## 下一步

✅ 部署成功后:
1. 在 https://sepolia.etherscan.io/ 验证合约
2. 测试前端功能
3. 邀请测试用户
4. 收集反馈

📚 详细文档: [docs/DEPLOY_TO_SEPOLIA.md](./DEPLOY_TO_SEPOLIA.md)

