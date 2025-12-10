#!/bin/bash

echo "🚀 ECBT Revenue Updater - Sepolia 配置向导"
echo "=========================================="
echo ""

# 检查是否已安装 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    echo ""
fi

# 检查配置文件
if [ ! -f "config.sepolia.json" ]; then
    echo "❌ 错误: config.sepolia.json 不存在"
    exit 1
fi

echo "📝 当前 Sepolia 配置:"
echo "-------------------------------------------"
cat config.sepolia.json | grep -E "(revenueManager|assetToken)" | head -2
echo "-------------------------------------------"
echo ""

# 提示用户配置
echo "⚙️  配置环境变量:"
echo ""
echo "请按照以下步骤配置:"
echo ""
echo "1. 设置 RPC URL:"
echo "   export RPC_URL=\"https://sepolia.infura.io/v3/YOUR_PROJECT_ID\""
echo "   # 或使用公共 RPC: export RPC_URL=\"https://rpc.sepolia.org\""
echo ""
echo "2. 设置私钥（用于发送交易）:"
echo "   export PRIVATE_KEY=\"0x...\""
echo "   # ⚠️  警告: 不要使用真实的主网私钥！"
echo ""
echo "3. （可选）设置资产 ID:"
echo "   export ASSET_ID=\"RealEstate\""
echo ""
echo "4. （可选）禁用链上更新（仅测试 Adapter）:"
echo "   export ENABLE_ONCHAIN=false"
echo ""

# 检查环境变量
echo "🔍 检查当前环境变量..."
echo ""

if [ -z "$RPC_URL" ]; then
    echo "❌ RPC_URL 未设置"
    HAS_ERROR=true
else
    echo "✅ RPC_URL: $RPC_URL"
fi

if [ -z "$PRIVATE_KEY" ]; then
    echo "⚠️  PRIVATE_KEY 未设置 (需要发送交易时使用)"
else
    echo "✅ PRIVATE_KEY: 已设置"
fi

if [ -z "$ADAPTER_CONTRACT" ]; then
    echo "ℹ️  ADAPTER_CONTRACT 未设置 (将使用配置文件中的地址)"
else
    echo "✅ ADAPTER_CONTRACT: $ADAPTER_CONTRACT"
fi

echo ""

if [ "$HAS_ERROR" = true ]; then
    echo "❌ 请先设置必要的环境变量"
    echo ""
    echo "快速配置示例:"
    echo "  export RPC_URL=\"https://rpc.sepolia.org\""
    echo "  export PRIVATE_KEY=\"0x...\""
    echo ""
    exit 1
fi

echo "✅ 配置检查完成!"
echo ""

# 显示可用命令
echo "📋 可用命令:"
echo "-------------------------------------------"
echo "1. 监控合约状态:"
echo "   npm run sepolia:monitor"
echo ""
echo "2. 启动自动更新服务:"
echo "   npm run sepolia:updater"
echo ""
echo "3. 启动 Adapter 服务:"
echo "   npm run start:adapter"
echo ""
echo "4. 启动 Mock API（测试用）:"
echo "   npm run start:mockapi"
echo ""
echo "-------------------------------------------"
echo ""

# 询问用户要执行什么
echo "请选择要执行的操作:"
echo "1) 监控合约状态"
echo "2) 启动完整服务（Adapter + Mock API + Updater）"
echo "3) 仅启动 Adapter"
echo "4) 退出"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🔍 启动合约监控..."
        npm run sepolia:monitor
        ;;
    2)
        echo ""
        echo "🚀 启动完整服务..."
        echo ""
        echo "打开 3 个终端窗口分别运行:"
        echo "  终端 1: npm run start:mockapi"
        echo "  终端 2: npm run start:adapter"
        echo "  终端 3: npm run sepolia:updater"
        echo ""
        echo "或使用 tmux/screen 在后台运行"
        ;;
    3)
        echo ""
        echo "🔌 启动 Adapter..."
        npm run start:adapter
        ;;
    4)
        echo "👋 退出"
        exit 0
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

