#!/bin/bash

# ========================================
# Revenue Updater - 一键启动脚本
# ========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║   Revenue Updater - One-Click Startup          ║"
echo "║   启动所有 Revenue Updater 服务                 ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# ========================================
# 步骤 1: 检查配置
# ========================================
echo -e "${YELLOW}📋 步骤 1/5: 检查配置...${NC}"

if [ ! -f "config.sepolia.json" ]; then
    echo -e "${RED}❌ 错误: config.sepolia.json 不存在${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: package.json 不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 配置文件存在${NC}"
echo ""

# ========================================
# 步骤 2: 检查依赖
# ========================================
echo -e "${YELLOW}📦 步骤 2/5: 检查依赖...${NC}"

if [ ! -d "node_modules" ]; then
    echo "   正在安装依赖..."
    npm install
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi
echo ""

# ========================================
# 步骤 3: 停止旧服务
# ========================================
echo -e "${YELLOW}🛑 步骤 3/5: 停止旧服务...${NC}"

pkill -f "node adapters/mockApi.cjs" 2>/dev/null && echo "   ✓ 已停止 Mock API" || echo "   - Mock API 未运行"
pkill -f "node adapters/adapter.cjs" 2>/dev/null && echo "   ✓ 已停止 Adapter" || echo "   - Adapter 未运行"
pkill -f "node adapters/updater" 2>/dev/null && echo "   ✓ 已停止 Updater" || echo "   - Updater 未运行"

sleep 2
echo ""

# ========================================
# 步骤 4: 启动服务
# ========================================
echo -e "${YELLOW}🚀 步骤 4/5: 启动服务...${NC}"

# 4.1 启动 Mock API
echo "   启动 Mock API..."
node adapters/mockApi.cjs > mockapi.log 2>&1 &
MOCK_API_PID=$!
sleep 2

# 验证 Mock API
if curl -s http://localhost:8081/api/revenue/RealEstate > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Mock API 启动成功 (PID: $MOCK_API_PID, 端口: 8081)${NC}"
else
    echo -e "   ${RED}❌ Mock API 启动失败${NC}"
    exit 1
fi

# 4.2 启动 Adapter
echo "   启动 Adapter..."
node adapters/adapter.cjs > adapter.log 2>&1 &
ADAPTER_PID=$!
sleep 2

# 验证 Adapter
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Adapter 启动成功 (PID: $ADAPTER_PID, 端口: 8080)${NC}"
else
    echo -e "   ${RED}❌ Adapter 启动失败${NC}"
    exit 1
fi

# 4.3 启动 Updater
echo "   启动 Updater..."

# 检查私钥
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "   ${RED}❌ 错误: 未设置 PRIVATE_KEY${NC}"
    echo ""
    echo "   请使用以下方式设置私钥："
    echo "   export PRIVATE_KEY='0x...'"
    echo "   ./start-all.sh"
    exit 1
fi

export PRIVATE_KEY
node adapters/updater.sepolia.cjs > updater.log 2>&1 &
UPDATER_PID=$!
sleep 3

# 验证 Updater
if ps -p $UPDATER_PID > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Updater 启动成功 (PID: $UPDATER_PID)${NC}"
else
    echo -e "   ${RED}❌ Updater 启动失败${NC}"
    echo "   查看日志: cat updater.log"
    exit 1
fi

echo ""

# ========================================
# 步骤 5: 验证服务
# ========================================
echo -e "${YELLOW}🔍 步骤 5/5: 验证服务...${NC}"
sleep 2

# 测试 Mock API
MOCK_DATA=$(curl -s http://localhost:8081/api/revenue/RealEstate)
echo "   Mock API 数据: $MOCK_DATA" | head -1

# 测试 Adapter
ADAPTER_DATA=$(curl -s -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"id":"test","data":{"assetId":"RealEstate"}}')
echo "   Adapter 数据: $ADAPTER_DATA" | head -1

# 显示 Updater 状态
echo "   Updater 日志:"
tail -5 updater.log | sed 's/^/      /'

echo ""

# ========================================
# 完成
# ========================================
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════╗"
echo "║            ✅ 所有服务启动成功！                ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "📊 服务状态:"
echo "   ✅ Mock API    (PID: $MOCK_API_PID) - http://localhost:8081"
echo "   ✅ Adapter     (PID: $ADAPTER_PID) - http://localhost:8080"
echo "   ✅ Updater     (PID: $UPDATER_PID) - 每 5 秒更新到 Sepolia"
echo ""
echo "📝 查看日志:"
echo "   tail -f mockapi.log"
echo "   tail -f adapter.log"
echo "   tail -f updater.log"
echo ""
echo "🛑 停止服务:"
echo "   pkill -f 'node adapters'"
echo "   或运行: ./stop-all.sh"
echo ""
echo "⏳ 服务运行中... 按 CTRL+C 返回终端 (服务继续后台运行)"
echo ""

# 等待用户按键
read -p "按任意键返回终端..."

