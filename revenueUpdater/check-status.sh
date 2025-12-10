#!/bin/bash

# ========================================
# Revenue Updater - 状态检查脚本
# ========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║      Revenue Updater 服务状态检查               ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# ========================================
# 检查进程状态
# ========================================
echo -e "${YELLOW}📊 进程状态:${NC}"
echo ""

# Mock API
if pgrep -f "node adapters/mockApi.cjs" > /dev/null 2>&1; then
    PID=$(pgrep -f "node adapters/mockApi.cjs")
    echo -e "${GREEN}✅ Mock API${NC} - 运行中 (PID: $PID)"
else
    echo -e "${RED}❌ Mock API${NC} - 未运行"
fi

# Adapter
if pgrep -f "node adapters/adapter.cjs" > /dev/null 2>&1; then
    PID=$(pgrep -f "node adapters/adapter.cjs")
    echo -e "${GREEN}✅ Adapter${NC} - 运行中 (PID: $PID)"
else
    echo -e "${RED}❌ Adapter${NC} - 未运行"
fi

# Updater
if pgrep -f "node adapters/updater" > /dev/null 2>&1; then
    PID=$(pgrep -f "node adapters/updater")
    echo -e "${GREEN}✅ Updater${NC} - 运行中 (PID: $PID)"
else
    echo -e "${RED}❌ Updater${NC} - 未运行"
fi

echo ""

# ========================================
# 测试服务端点
# ========================================
echo -e "${YELLOW}🔍 测试服务端点:${NC}"
echo ""

# 测试 Mock API
echo -n "   Mock API (8081): "
if curl -s http://localhost:8081/api/revenue/RealEstate > /dev/null 2>&1; then
    RESPONSE=$(curl -s http://localhost:8081/api/revenue/RealEstate)
    REVENUE=$(echo $RESPONSE | grep -o '"revenue":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ 响应正常${NC} - Revenue: $REVENUE"
else
    echo -e "${RED}❌ 无响应${NC}"
fi

# 测试 Adapter
echo -n "   Adapter (8080): "
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 响应正常${NC}"
else
    echo -e "${RED}❌ 无响应${NC}"
fi

echo ""

# ========================================
# 显示最新日志
# ========================================
echo -e "${YELLOW}📝 最新日志 (最后5行):${NC}"
echo ""

if [ -f "mockapi.log" ]; then
    echo -e "${BLUE}Mock API:${NC}"
    tail -5 mockapi.log | sed 's/^/   /'
    echo ""
fi

if [ -f "adapter.log" ]; then
    echo -e "${BLUE}Adapter:${NC}"
    tail -5 adapter.log | sed 's/^/   /'
    echo ""
fi

if [ -f "updater.log" ]; then
    echo -e "${BLUE}Updater:${NC}"
    tail -5 updater.log | sed 's/^/   /'
    echo ""
fi

# ========================================
# 显示统计信息
# ========================================
if [ -f "updater.log" ]; then
    echo -e "${YELLOW}📊 更新统计:${NC}"
    
    # 提取最新的统计信息
    SUCCESS=$(grep "成功:" updater.log | tail -1 | grep -o "成功: [0-9]*" | cut -d' ' -f2)
    TOTAL=$(grep "总更新次数:" updater.log | tail -1 | grep -o "总更新次数: [0-9]*" | cut -d' ' -f2)
    RATE=$(grep "成功率:" updater.log | tail -1 | grep -o "[0-9]*\.[0-9]*%")
    
    if [ ! -z "$TOTAL" ]; then
        echo "   总更新次数: $TOTAL"
        echo "   成功次数: $SUCCESS"
        echo "   成功率: $RATE"
    else
        echo "   暂无统计数据"
    fi
    echo ""
fi

# ========================================
# 显示命令
# ========================================
echo -e "${YELLOW}💡 常用命令:${NC}"
echo ""
echo "   查看实时日志:"
echo "     tail -f mockapi.log"
echo "     tail -f adapter.log"
echo "     tail -f updater.log"
echo ""
echo "   停止所有服务:"
echo "     ./stop-all.sh"
echo ""
echo "   重启服务:"
echo "     ./start-all.sh"
echo ""

# ========================================
# 显示链上信息
# ========================================
if [ -f "updater.log" ]; then
    LATEST_TX=$(grep "交易哈希:" updater.log | tail -1 | grep -o "0x[a-fA-F0-9]*")
    if [ ! -z "$LATEST_TX" ]; then
        echo -e "${YELLOW}🔗 最新交易:${NC}"
        echo "   $LATEST_TX"
        echo "   https://sepolia.etherscan.io/tx/$LATEST_TX"
        echo ""
    fi
fi

echo -e "${GREEN}✅ 状态检查完成${NC}"

