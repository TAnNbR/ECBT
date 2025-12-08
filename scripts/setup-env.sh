#!/bin/bash

echo "=========================================="
echo "  Sepolia 部署环境配置向导"
echo "=========================================="
echo ""

# 检查是否已存在 .env 文件
if [ -f .env ]; then
    echo "⚠️  .env 文件已存在"
    read -p "是否覆盖? (y/N): " overwrite
    if [[ ! $overwrite =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 0
    fi
fi

echo ""
echo "请提供以下配置信息:"
echo ""

# Sepolia RPC URL
echo "1️⃣  Sepolia RPC URL"
echo "   获取方式: https://www.alchemy.com/ 或 https://www.infura.io/"
echo "   示例: https://eth-sepolia.g.alchemy.com/v2/your-api-key"
read -p "   请输入 RPC URL: " rpc_url

if [ -z "$rpc_url" ]; then
    echo "❌ RPC URL 不能为空"
    exit 1
fi

# Private Key
echo ""
echo "2️⃣  部署账户私钥"
echo "   从 MetaMask 导出 (账户详情 -> 导出私钥)"
echo "   ⚠️  请勿包含 0x 前缀"
echo "   ⚠️  仅用于测试，不要使用主网私钥"
read -sp "   请输入私钥: " private_key
echo ""

if [ -z "$private_key" ]; then
    echo "❌ 私钥不能为空"
    exit 1
fi

# 验证私钥格式（应该是64个字符）
if [ ${#private_key} -ne 64 ]; then
    echo "⚠️  警告: 私钥长度不是64个字符，请确认是否正确"
fi

# Etherscan API Key (可选)
echo ""
echo "3️⃣  Etherscan API Key (可选，用于合约验证)"
echo "   获取方式: https://etherscan.io/myapikey"
read -p "   请输入 API Key (可以留空): " etherscan_key

# 创建 .env 文件
cat > .env << EOF
# Sepolia 测试网配置
SEPOLIA_RPC_URL=$rpc_url
PRIVATE_KEY=$private_key
ETHERSCAN_API_KEY=$etherscan_key
EOF

echo ""
echo "✅ .env 文件创建成功!"
echo ""

# 验证账户余额
echo "正在检查账户余额..."
echo ""

# 使用独立的余额检查脚本
npx hardhat run scripts/check-sepolia-balance.js --network sepolia

echo ""
echo "=========================================="
echo "配置完成! 下一步:"
echo "=========================================="
echo ""
echo "1. 确保账户有足够的 Sepolia ETH (≥ 0.5 ETH)"
echo "2. 执行部署:"
echo "   npx hardhat run scripts/deploy-sepolia.js --network sepolia"
echo ""

