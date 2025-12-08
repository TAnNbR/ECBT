#!/bin/bash

# 从 deployment-info.json 读取合约地址并生成 .env.local 文件

DEPLOYMENT_FILE="../deployment-info.json"
ENV_FILE=".env.local"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "Error: deployment-info.json not found!"
    exit 1
fi

echo "从 $DEPLOYMENT_FILE 生成前端环境配置..."

# 使用 jq 或 grep 提取合约地址
ASSET_TOKEN=$(grep -oP '"AssetToken":\s*"\K[^"]+' $DEPLOYMENT_FILE)
COLLATERAL_VAULT=$(grep -oP '"CollateralVault":\s*"\K[^"]+' $DEPLOYMENT_FILE)
REVENUE_MANAGER=$(grep -oP '"RevenueManager":\s*"\K[^"]+' $DEPLOYMENT_FILE)
LIQUIDATE_MANAGER=$(grep -oP '"LiquidateManager":\s*"\K[^"]+' $DEPLOYMENT_FILE)
ORDER_BOOK=$(grep -oP '"OrderBook":\s*"\K[^"]+' $DEPLOYMENT_FILE)
PAYMENT_TOKEN=$(grep -oP '"MockERC20":\s*"\K[^"]+' $DEPLOYMENT_FILE)

# 创建 .env.local 文件
cat > $ENV_FILE << EOF
# Local Hardhat Network Configuration
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545

# Contract Addresses (from deployment-info.json)
NEXT_PUBLIC_ASSET_TOKEN_ADDRESS=$ASSET_TOKEN
NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=$COLLATERAL_VAULT
NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=$REVENUE_MANAGER
NEXT_PUBLIC_LIQUIDATE_MANAGER_ADDRESS=$LIQUIDATE_MANAGER
NEXT_PUBLIC_ORDER_BOOK_ADDRESS=$ORDER_BOOK
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=$PAYMENT_TOKEN

# WalletConnect Project ID (optional for local development)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo_project_id
EOF

echo "✓ 已创建 $ENV_FILE"
echo ""
echo "配置的合约地址:"
echo "  AssetToken:        $ASSET_TOKEN"
echo "  CollateralVault:   $COLLATERAL_VAULT"
echo "  RevenueManager:    $REVENUE_MANAGER"
echo "  LiquidateManager:  $LIQUIDATE_MANAGER"
echo "  OrderBook:         $ORDER_BOOK"
echo "  PaymentToken:      $PAYMENT_TOKEN"
echo ""
echo "请重启前端服务以应用新配置: npm run dev"

