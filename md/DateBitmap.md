# DateBitmap - 高效日期存储与查询

## 概述

`DateBitmap` 是一个基于位图的高效日期存储和查询合约，使用位运算实现极低的 Gas 成本。

### 核心特性

- ✅ 每个 bit 代表一天（从 00:00:00 到 23:59:59）
- ✅ 支持任意时间范围（理论上无限）
- ✅ 极低的存储成本（256天仅占用1个存储槽）
- ✅ 快速的查询性能
- ✅ 灵活的查询接口

## 工作原理

### 1. 时间戳 → 天数索引

```
时间戳: 1700118000 (2023-11-16 11:33:20 UTC)
        ↓
天数索引: 1700118000 / 86400 = 19677
        ↓
含义: 从 1970-01-01 开始的第 19677 天
```

### 2. 天数索引 → Bitmap 位置

```
天数索引: 19677
        ↓
slotIndex = 19677 / 256 = 76
bitPosition = 19677 % 256 = 221
        ↓
存储在: dateBitmap[76] 的第 221 位
```

### 3. Bitmap 存储结构

```solidity
mapping(uint256 => uint256) public dateBitmap;

// dateBitmap[0]: 存储第 0-255 天
// dateBitmap[1]: 存储第 256-511 天
// dateBitmap[2]: 存储第 512-767 天
// ...
// dateBitmap[76]: 存储第 19456-19711 天 (包含 2023-11-16)
```

### 4. 位运算操作

```solidity
// 设置 bit (标记某天)
uint256 mask = 1 << bitPosition;        // 创建掩码: 1 << 221
dateBitmap[slotIndex] |= mask;          // OR 运算设置 bit

// 清除 bit (取消标记)
dateBitmap[slotIndex] &= ~mask;         // AND NOT 运算清除 bit

// 检查 bit (查询某天)
bool isSet = (dateBitmap[slotIndex] & mask) != 0;  // AND 运算检查
```

## 使用示例

### 示例 1: 基本操作

```solidity
DateBitmap bitmap = new DateBitmap();

// 标记某天 (使用时间戳)
bitmap.setDate(1700092800);  // 2023-11-16 00:00:00

// 检查某天是否被标记
bool isSet = bitmap.isDateSet(1700092800);  // true

// 取消标记
bitmap.unsetDate(1700092800);
```

### 示例 2: 批量设置时间段

```solidity
// 标记 2023-11-16 到 2023-11-30 的所有日期
uint256 start = 1700092800;  // 2023-11-16 00:00:00
uint256 end = 1701302400;    // 2023-11-30 00:00:00

bitmap.setDateRange(start, end);
// Gas 成本: 约 15 * 5000 = 75,000 gas (15天)
```

### 示例 3: 查询时间段内的日期

```solidity
// 查询 11月有哪些天被标记
uint256 start = 1698768000;  // 2023-11-01 00:00:00
uint256 end = 1701359999;    // 2023-11-30 23:59:59

// 方法1: 获取天数索引
uint256[] memory dayIndices = bitmap.findMarkedDatesInRange(start, end);
// 返回: [19662, 19663, 19665, ...] (被标记的天数索引)

// 方法2: 获取时间戳 (每天的 00:00:00)
uint256[] memory timestamps = bitmap.findMarkedDatesAsTimestamps(start, end);
// 返回: [1700092800, 1700179200, ...] (被标记日期的时间戳)

// 方法3: 获取详细信息
DateBitmap.DateInfo[] memory dates = bitmap.findMarkedDatesDetailed(start, end);
// 返回: [{dayIndex: 19662, timestamp: 1700092800, year: 2023, ...}, ...]
```

### 示例 4: 统计操作

```solidity
// 统计某个月有多少天有数据
uint256 count = bitmap.countMarkedDatesInRange(start, end);
// 返回: 15 (表示有15天被标记)
```

## 实际应用场景

### 场景 1: 收益记录系统

```solidity
contract RevenueTracker is DateBitmap {
    // 记录每天的收益数据
    mapping(uint256 => uint256) public dailyRevenue;
    
    function recordRevenue(uint256 timestamp, uint256 amount) external {
        // 标记这一天有收益
        setDate(timestamp);
        
        // 存储收益金额
        uint256 dayIndex = timestampToDayIndex(timestamp);
        dailyRevenue[dayIndex] = amount;
    }
    
    function getRevenueInRange(
        uint256 start,
        uint256 end
    ) external view returns (uint256 total) {
        // 快速找到有收益的日期
        uint256[] memory revenueDays = findMarkedDatesInRange(start, end);
        
        // 只累加有收益的天数
        for (uint256 i = 0; i < revenueDays.length; i++) {
            total += dailyRevenue[revenueDays[i]];
        }
        
        return total;
    }
}
```

### 场景 2: 数据完整性检查

```solidity
contract DataIntegrityChecker is DateBitmap {
    function checkDataCompleteness(
        uint256 start,
        uint256 end
    ) external view returns (
        uint256 totalDays,
        uint256 markedDays,
        uint256 missingDays,
        uint256 coveragePercent
    ) {
        uint256 startDay = timestampToDayIndex(start);
        uint256 endDay = timestampToDayIndex(end);
        
        totalDays = endDay - startDay + 1;
        markedDays = countMarkedDatesInRange(start, end);
        missingDays = totalDays - markedDays;
        coveragePercent = (markedDays * 100) / totalDays;
        
        return (totalDays, markedDays, missingDays, coveragePercent);
    }
}
```

### 场景 3: 周期性任务跟踪

```solidity
contract TaskTracker is DateBitmap {
    function markTaskComplete(uint256 timestamp) external {
        setDate(timestamp);
    }
    
    function hasCompletedAllDays(
        uint256 start,
        uint256 end
    ) external view returns (bool) {
        uint256 totalDays = (timestampToDayIndex(end) - timestampToDayIndex(start)) + 1;
        uint256 completedDays = countMarkedDatesInRange(start, end);
        
        return completedDays == totalDays;
    }
}
```

## Gas 成本分析

### 操作成本对比

| 操作 | Gas 消耗 | 说明 |
|------|---------|------|
| **setDate()** | | |
| - 首次设置某个 slot | ~22,100 | 冷 SSTORE |
| - 在已有 slot 中设置 | ~5,000 | 热 SSTORE |
| **setDateRange(n天)** | | |
| - 在同一 slot (n≤256) | ~5,000 × n | 约 5k/天 |
| - 跨多个 slot | 变化 | 首次槽贵 |
| **isDateSet()** | ~2,100 | SLOAD + 位运算 |
| **findMarkedDatesInRange(30天)** | ~35,000 | 遍历30天 |
| **countMarkedDatesInRange(30天)** | ~30,000 | 纯计数 |

### 与传统方案对比

#### 方案 A: 数组存储

```solidity
uint256[] public markedDates;

function addDate(uint256 timestamp) {
    markedDates.push(timestamp);  // ~25,000 gas
}

function findDates(uint256 start, uint256 end) {
    // 遍历整个数组: O(n)
    // Gas: ~1,000 × n
}
```

#### 方案 B: Bitmap (本方案)

```solidity
function setDate(uint256 timestamp) {
    // ~5,000 gas (热 SSTORE)
}

function findDates(uint256 start, uint256 end) {
    // 只遍历时间范围: O(days)
    // Gas: ~1,000 × days
}
```

### 成本对比表

| 场景 | 数组方案 | Bitmap 方案 | 节省 |
|------|---------|------------|------|
| 添加 1 条 | 25,000 | 5,000 | 80% |
| 添加 100 条 | 2,500,000 | 500,000 | 80% |
| 查询 30 天 | 100,000+ | 35,000 | 65% |
| 存储成本 | 每条 1 slot | 256天 1 slot | 99.6% |

## 高级优化技巧

### 优化 1: 批量查询优化

```solidity
// 优化前: 多次遍历
for (uint256 month = 1; month <= 12; month++) {
    findMarkedDatesInRange(getMonthStart(month), getMonthEnd(month));
}

// 优化后: 一次遍历
uint256[] memory allDates = findMarkedDatesInRange(
    getMonthStart(1), 
    getMonthEnd(12)
);
```

### 优化 2: 使用位运算优化整个 slot 的操作

```solidity
// 如果某个 slot 全为 0，跳过
function findMarkedDatesOptimized(
    uint256 startDay,
    uint256 endDay
) internal view returns (uint256[] memory) {
    uint256 startSlot = startDay / 256;
    uint256 endSlot = endDay / 256;
    
    // 先检查 slot 是否为空
    for (uint256 slot = startSlot; slot <= endSlot; slot++) {
        if (dateBitmap[slot] == 0) {
            continue;  // 跳过空的 slot，节省 Gas
        }
        
        // 只处理非空的 slot
        // ...
    }
}
```

### 优化 3: 缓存热数据

```solidity
// 缓存最近查询的结果
mapping(bytes32 => uint256[]) private queryCache;

function findMarkedDatesCached(
    uint256 start,
    uint256 end
) external view returns (uint256[] memory) {
    bytes32 cacheKey = keccak256(abi.encodePacked(start, end));
    
    if (queryCache[cacheKey].length > 0) {
        return queryCache[cacheKey];  // 返回缓存
    }
    
    // 执行查询并缓存...
}
```

## 常见问题 (FAQ)

### Q1: 为什么使用天数索引而不是直接使用时间戳？

**A**: 天数索引更小，便于映射到 bitmap。时间戳是秒级（10位数），而天数索引是天级（5位数），节省存储空间。

### Q2: 同一天的不同时间戳会被视为同一天吗？

**A**: 是的。所有属于同一天（UTC 00:00:00 到 23:59:59）的时间戳都会映射到同一个 bit。

```solidity
setDate(1700092800);  // 2023-11-16 00:00:00
setDate(1700179199);  // 2023-11-16 23:59:59
// 两者设置的是同一个 bit
```

### Q3: 最多可以存储多少天？

**A**: 理论上无限。`uint256` 的 mapping 可以容纳 2^256 个 slot，每个 slot 存储 256 天，总共可以存储 256 × 2^256 天。

### Q4: 查询大范围时间段会不会很慢？

**A**: 查询成本与时间范围的**天数**成正比，而不是与数据总量成正比。查询 30 天约消耗 35,000 gas，查询 365 天约消耗 420,000 gas。

### Q5: 如何处理时区问题？

**A**: 合约使用 UTC 时间。如果需要本地时区，请在链下转换：

```javascript
// JavaScript 示例
const localDate = new Date('2023-11-16T00:00:00+08:00');  // 北京时间
const utcTimestamp = Math.floor(localDate.getTime() / 1000);  // 转 UTC
await bitmap.setDate(utcTimestamp);
```

## 总结

### 适用场景

✅ **推荐使用**:
- 需要记录事件发生的日期
- 需要快速查询某个时间段内有哪些日期有数据
- 数据量大，需要节省存储成本
- 需要进行日期级别的统计分析

❌ **不推荐**:
- 需要精确到秒的时间记录
- 需要记录每天多次事件
- 时间范围极大且稀疏（例如跨越数千年但只有几个点）

### 核心优势

1. **极低存储成本**: 256天仅占用1个存储槽
2. **高效查询**: 查询成本仅与时间范围成正比
3. **简单易用**: API 设计直观，易于集成
4. **灵活扩展**: 支持任意时间范围

### Gas 成本总结

```
设置单天: ~5,000 gas
查询30天: ~35,000 gas
批量设置365天: ~1,825,000 gas

对比传统数组方案，节省 65-80% 的 Gas 成本
```
