# 💧 USDT Faucet Setup Guide

## 🎯 功能

用户可以在前端页面输入任意数量，自动领取测试用的 USDT 代币。

**特点：**
- ✨ 任意金额（最高 100 亿 USDT）
- ⚡ 无时间限制
- 🚀 即时到账
- 💯 无需审批

## 📁 创建的文件

1. **前端页面**: `frontend/src/app/faucet/page.tsx`
2. **API 端点**: `frontend/src/app/api/faucet/route.ts`
3. **导航链接**: 在 `Header.tsx` 中添加

## 🔧 配置步骤

### 1. 添加 Faucet 私钥到环境变量

编辑 `frontend/.env.local`，添加：

```bash
# Faucet Private Key (deployer 的私钥)
FAUCET_PRIVATE_KEY=0x你的私钥
```

**这个私钥必须是部署合约的账户**，因为只有部署者有权限调用 `MockERC20.mint()`。

在 Sepolia 上，deployer 是：`0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7`

### 2. 重启前端服务

```bash
cd /home/smx/ECBT/frontend
pkill -f "next dev"
npm run dev
```

### 3. 访问 Faucet 页面

```
http://localhost:3000/faucet
```

## 🎨 页面功能

### 用户界面

1. **显示当前 USDT 余额**
2. **金额输入框** - 用户可以输入任意数量
3. **快捷按钮** - 10K, 100K, 1M, 10M 快速选择
4. **领取按钮** - 即时铸造代币
5. **无时间限制** - 可以无限次领取
6. **交易记录** - 显示 Etherscan 链接
7. **使用说明** - 详细的步骤指引
8. **合约信息** - 显示 USDT 合约地址

### API 功能

**POST `/api/faucet`**

请求：
```json
{
  "address": "0x...",
  "amount": "100000"
}
```

响应（成功）：
```json
{
  "success": true,
  "txHash": "0x...",
  "amount": "100000",
  "recipient": "0x...",
  "explorerUrl": "https://sepolia.etherscan.io/tx/..."
}
```

响应（金额过大）：
```json
{
  "error": "Amount too large. Maximum: 10,000,000,000 USDT"
}
```

响应（无效金额）：
```json
{
  "error": "Invalid amount. Must be a positive number"
}
```

**GET `/api/faucet`**

查看 Faucet 状态：
```bash
curl http://localhost:3000/api/faucet
```

## 🔐 安全考虑

### 1. 金额限制
- 单次最大：100 亿 USDT
- 用户可以输入任意数量（测试网络，无需严格限制）
- 可以在 API 代码中调整 `MAX_AMOUNT`

### 2. 私钥安全
- **不要把私钥提交到 Git！**
- 使用环境变量存储
- `.env.local` 已在 `.gitignore` 中
- 私钥仅在服务器端使用，不暴露给前端

### 3. 网络隔离
- 仅在 Sepolia 测试网使用
- 测试代币无实际价值
- 不要在主网使用此 Faucet

## 🧪 测试

### 1. 测试 API

```bash
curl -X POST http://localhost:3000/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7"}'
```

### 2. 测试冷却时间

连续点击两次 "Claim Tokens"，第二次应该提示需要等待。

### 3. 检查余额

领取后在前端查看 USDT 余额是否增加。

## 🎯 使用流程

```
用户访问 /faucet
    ↓
连接钱包
    ↓
点击 "Claim Tokens"
    ↓
前端调用 POST /api/faucet
    ↓
API 使用 FAUCET_PRIVATE_KEY 签名交易
    ↓
调用 MockERC20.mint(user, 100000 USDT)
    ↓
交易上链
    ↓
用户收到 USDT ✅
```

## 📝 环境变量完整配置

```bash
# frontend/.env.local

# Network
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# Contracts
NEXT_PUBLIC_ASSET_TOKEN_ADDRESS=0xCD7FF2BFbB5ce16D629B5b09F29c9359C075b36D
NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=0x21C08CA468143Da59847eD0A5842885891024471
NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=0x327C7dc5071E77aBe5df5Bf8FA3c82045E1294be
NEXT_PUBLIC_LIQUIDATE_MANAGER_ADDRESS=0x4dE3101B696b7BD18726345111181A5c1F927259
NEXT_PUBLIC_ORDER_BOOK_ADDRESS=0x55F42005184d9D386a54e0BDa14ccCaF330B2062
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=0x47785ECE94B84ee41E21435A6A75d46646b78D85

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Faucet (后端私钥，不要暴露给前端)
FAUCET_PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
```

## ⚠️ 重要提示

### FAUCET_PRIVATE_KEY 必须是部署者的私钥

在 Sepolia 上，部署者是：`0x58ac06617D42bCa05D958d7Ee314f621FD8C16b7`

这个账户在部署时成为了 MockERC20 的 owner，拥有 mint 权限。

## 🌐 导航位置

Header 导航栏新增：

```
[ECBT Platform] [Dashboard] [Market] [Portfolio] [Faucet 💧] [Connect Wallet]
```

点击 "Faucet 💧" 即可访问领取页面。

## ✅ 完成清单

- [x] 创建 Faucet 页面 UI
- [x] 创建 Faucet API 端点
- [x] 添加速率限制（24小时）
- [x] 添加导航链接
- [x] 更新环境变量示例
- [x] 创建配置文档

## 🚀 立即使用

1. 添加 `FAUCET_PRIVATE_KEY` 到 `.env.local`
2. 重启前端：`npm run dev`
3. 访问：http://localhost:3000/faucet
4. 点击 "Claim Tokens"
5. 收到 100,000 USDT！

现在用户可以自助领取测试代币了！💧🎉

