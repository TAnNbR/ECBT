#!/bin/bash

echo "🚀 启动 Sepolia Revenue Updater"
echo "================================"
echo ""

# 检查私钥
if [ -z "$PRIVATE_KEY" ]; then
    echo "⚠️  未检测到 PRIVATE_KEY 环境变量"
    echo ""
    echo "请设置你的私钥："
    echo "  export PRIVATE_KEY=\"0x你的私钥\""
    echo ""
    echo "⚠️  重要提示："
    echo "  - 使用测试账户的私钥"
    echo "  - 确保账户有 Sepolia ETH"
    echo "  - 获取测试 ETH: https://sepoliafaucet.com/"
    echo ""
    read -p "是否要输入私钥? (y/n): " input_key
    
    if [ "$input_key" == "y" ] || [ "$input_key" == "Y" ]; then
        read -sp "请输入私钥 (0x...): " PRIVATE_KEY
        echo ""
        export PRIVATE_KEY
    else
        echo "❌ 未设置私钥，退出"
        exit 1
    fi
fi

echo "✅ 私钥已设置"
echo ""

# 检查服务状态
echo "🔍 检查服务状态..."
echo ""

# 检查 Mock API
if curl -s http://localhost:8081/api/revenue/RealEstate > /dev/null 2>&1; then
    echo "✅ Mock API (8081) 运行中"
else
    echo "❌ Mock API 未运行"
    echo "   启动命令: npm run start:mockapi"
    exit 1
fi

# 检查 Adapter
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Adapter (8080) 运行中"
else
    echo "❌ Adapter 未运行"
    echo "   启动命令: npm run start:adapter"
    exit 1
fi

echo ""
echo "✅ 所有依赖服务已启动"
echo ""
echo "🚀 启动 Revenue Updater..."
echo "   合约: 0x61021de691B28c3Be6312105A66d03Ba215f1a23"
echo "   资产: RealEstate"
echo "   间隔: 5 秒"
echo ""
echo "按 CTRL+C 停止服务"
echo ""
echo "========================================"
echo ""

# 启动 updater
cd /home/smx/ECBT/revenueUpdater
node adapters/updater.sepolia.cjs

