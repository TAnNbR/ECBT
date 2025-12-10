#!/bin/bash

# ========================================
# Revenue Updater - 停止所有服务
# ========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║      停止所有 Revenue Updater 服务              ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# 停止 Mock API
if pkill -f "node adapters/mockApi.cjs" 2>/dev/null; then
    echo -e "${GREEN}✅ 已停止 Mock API${NC}"
else
    echo -e "${YELLOW}⚠️  Mock API 未运行${NC}"
fi

# 停止 Adapter
if pkill -f "node adapters/adapter.cjs" 2>/dev/null; then
    echo -e "${GREEN}✅ 已停止 Adapter${NC}"
else
    echo -e "${YELLOW}⚠️  Adapter 未运行${NC}"
fi

# 停止 Updater
if pkill -f "node adapters/updater" 2>/dev/null; then
    echo -e "${GREEN}✅ 已停止 Updater${NC}"
else
    echo -e "${YELLOW}⚠️  Updater 未运行${NC}"
fi

sleep 1

# 验证所有进程已停止
if pgrep -f "node adapters" > /dev/null 2>&1; then
    echo -e "${RED}⚠️  仍有进程在运行${NC}"
    echo "运行中的进程:"
    ps aux | grep "node adapters" | grep -v grep
    echo ""
    echo "强制停止所有进程:"
    echo "   pkill -9 -f 'node adapters'"
else
    echo ""
    echo -e "${GREEN}✅ 所有服务已停止${NC}"
fi

echo ""
echo "📝 日志文件保留在:"
echo "   mockapi.log"
echo "   adapter.log"
echo "   updater.log"
echo ""

