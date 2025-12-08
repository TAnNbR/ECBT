#!/bin/bash

# 从 deployment-info-sepolia.json 读取合约地址并生成前端 .env.local 文件

DEPLOYMENT_FILE="../deployment-info-sepolia.json"
ENV_FILE=".env.local"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "Error: deployment-info-sepolia.json not found!"
    echo "请先部署合约到 Sepolia: npx hardhat run scripts/deploy-sepolia.js --network sepolia"
    exit 1
fi

echo "从 $DEPLOYMENT_FILE 生成前端环境配置..."

# 提取合约地址
ASSET_TOKEN=$(grep -oP '"AssetToken":\s*"\K[^"]+' $DEPLOYMENT_FILE)
COLLATERAL_VAULT=$(grep -oP '"CollateralVault":\s*"\K[^"]+' $DEPLOYMENT_FILE)
REVENUE_MANAGER=$(grep -oP '"RevenueManager":\s*"\K[^"]+' $DEPLOYMENT_FILE)
LIQUIDATE_MANAGER=$(grep -oP '"LiquidateManager":\s*"\K[^"]+' $DEPLOYMENT_FILE)
ORDER_BOOK=$(grep -oP '"OrderBook":\s*"\K[^"]+' $DEPLOYMENT_FILE)
PAYMENT_TOKEN=$(grep -oP '"MockERC20":\s*"\K[^"]+' $DEPLOYMENT_FILE)

# 创建 .env.local 文件
cat > $ENV_FILE << EOF
# Sepolia Testnet Configuration
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# Contract Addresses (from deployment-info-sepolia.json)
NEXT_PUBLIC_ASSET_TOKEN_ADDRESS=$ASSET_TOKEN
NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=$COLLATERAL_VAULT
NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=$REVENUE_MANAGER
NEXT_PUBLIC_LIQUIDATE_MANAGER_ADDRESS=$LIQUIDATE_MANAGER
NEXT_PUBLIC_ORDER_BOOK_ADDRESS=$ORDER_BOOK
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=$PAYMENT_TOKEN

# WalletConnect Project ID
# 从 https://cloud.walletconnect.com/ 获取
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
EOF

echo "✓ 已创建 $ENV_FILE"
echo ""
echo "配置的合约地址 (Sepolia):"
echo "  AssetToken:        $ASSET_TOKEN"
echo "  CollateralVault:   $COLLATERAL_VAULT"
echo "  RevenueManager:    $REVENUE_MANAGER"
echo "  LiquidateManager:  $LIQUIDATE_MANAGER"
echo "  OrderBook:         $ORDER_BOOK"
echo "  PaymentToken:      $PAYMENT_TOKEN"
echo ""
echo "⚠️  请手动更新以下配置:"
echo "  1. NEXT_PUBLIC_RPC_URL - 您的 Sepolia RPC URL"
echo "  2. NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID - WalletConnect Project ID"
echo ""
echo "然后重启前端服务: npm run dev"

