# AssetToken cancelOrder 测试用例说明

## 文档版本
- 版本: 1.1
- 最后更新: 2025-12-07
- 对应合约: `AssetToken.sol` v1.1
- 对应测试文件: `test/AssetToken.sellShares.test.js`

## 一、函数概述

### 1.1 函数签名
```solidity
function cancelOrder(uint256 orderId) external
```

### 1.2 核心功能
`cancelOrder` 函数允许卖单创建者取消活跃的卖单，并恢复被冻结的份额。

### 1.3 执行流程
1. 验证 OrderBook 已设置
2. 从 OrderBook 获取订单信息
3. 验证订单所有权和状态
4. 计算退还数量 = 订单总量 - 已成交量
5. 调用 OrderBook.cancelOrder 更新订单状态
6. 恢复持有者信息，保留订单创建时的分红和清算时间

### 1.4 关键特性
- **时间戳保留**: 退还的份额保留订单创建时的 `lastDividendTime` 和 `lastLiquidationClaimTime`，确保可以正确计算期间收益
- **部分成交支持**: 仅退还未成交部分的份额
- **权限验证**: 通过 `order.seller == msg.sender` 验证所有权
- **OrderBook 信任**: OrderBook 合约信任 AssetToken 合约的权限检查

## 二、测试环境设置

### 2.1 合约部署
- **MockERC20**: USDT 稳定币，精度 6 位
- **CollateralVault**: 抵押金和收益管理
- **RevenueManager**: 收益记录管理（单位时间：2秒）
- **LiquidateManager**: 清算管理（季度周期：7天，预期分红：10,000 USDT）
- **OrderBook**: 订单簿（手续费率：0.5%）
- **AssetToken**: 资产代币（总价值：1,000,000 USDT，募资金额：500,000 USDT，最大供应量：1,000,000）

### 2.2 关联设置
- AssetToken.setOrderBook(orderBook.address)
- OrderBook.setAssetToken(assetToken.address) - **重要**：允许 AssetToken 代表用户取消订单

### 2.3 测试账户
- `owner`: 合约所有者和手续费收集者
- `seller`: 卖方账户（执行 purchase、sellShares、cancelOrder）
- `buyer`: 买方账户
- `provider`: 服务提供商（提供抵押金和收益）
- `recipient`: 收益接收者

### 2.4 资金准备
- seller: 600,000 USDT
- buyer: 600,000 USDT
- provider: 1,000,000 USDT

## 三、测试用例详解

### 分组 1: 基本 cancelOrder 功能测试 (9 个)

#### 测试 1: 应该成功取消订单
**目的**: 验证正常取消订单的流程

**前置条件**:
- seller 购买全部代币（触发售罄）
- 等待 2 天后（满足 onlySoldOut）
- 创建卖单（200,000 份额）

**测试步骤**:
1. 验证订单状态为 Active
2. 调用 cancelOrder
3. 验证订单状态更新为 Cancelled

**预期结果**:
- 订单状态从 Active 变为 Cancelled
- 交易成功执行

**验证点**:
- `order.status == OrderStatus.Cancelled`

**业务意义**: 确保用户可以正常取消自己的卖单

---

#### 测试 2: 取消订单后应该恢复份额
**目的**: 验证取消订单后份额正确恢复到持有者账户

**前置条件**:
- seller 购买全部代币
- 创建卖单（100,000 份额）

**测试步骤**:
1. sellShares 后检查 holderInfo[0].shares = 1,000,000（合并后）
2. cancelOrder
3. 检查 holderInfo[1].shares = 100,000（退还的份额）

**预期结果**:
- holderInfo 数组长度增加 1
- 新增的 holderInfo 包含退还的份额

**验证点**:
- `holderInfo[seller][1].shares == 100,000`

**业务意义**: 确保取消订单后用户可以重新获得份额的控制权

---

#### 测试 3: 取消订单后应该保留订单创建时的时间戳
**目的**: 验证退还的份额正确保留订单创建时的时间戳，以便计算期间收益

**前置条件**:
- 记录收益并提取（更新 lastDividendTime）
- 创建卖单
- 等待一段时间后取消订单

**测试步骤**:
1. 记录收益 + 提取分红（更新时间戳 T1）
2. 等待 2 天
3. sellShares（内部调用 withdrawDividend，时间戳更新为 T2）
4. 获取订单中的 lastDividendTime 和 lastLiquidationClaimTime
5. 等待 2 天后 cancelOrder
6. 验证 holderInfo[1] 的时间戳等于订单中保存的时间戳

**预期结果**:
- `holderInfo[1].lastDividendTime == order.lastDividendTime`
- `holderInfo[1].lastLiquidationClaimTime == order.lastLiquidationClaimTime`

**验证点**:
- 退还份额的时间戳与订单创建时一致

**业务意义**: 确保用户在取消订单后仍可领取期间的分红和清算金

---

#### 测试 4: 应该正确处理部分成交后的取消
**目的**: 验证部分成交订单取消时，仅退还未成交部分

**前置条件**:
- 创建卖单（100,000 份额）
- 模拟部分成交（30,000 份额）

**测试步骤**:
1. sellShares(100,000)
2. orderBook.fillOrder(orderId, 30,000)
3. 验证 order.filledAmount == 30,000
4. cancelOrder
5. 验证退还份额 = 100,000 - 30,000 = 70,000

**预期结果**:
- holderInfo[1].shares == 70,000（仅退还未成交部分）

**验证点**:
- `refundAmount == sellAmount - filledAmount`

**业务意义**: 确保已成交部分不会被错误退还

---

#### 测试 5: 应该拒绝取消他人的订单
**目的**: 验证订单所有权验证

**前置条件**:
- seller 创建卖单

**测试步骤**:
1. seller.sellShares()
2. buyer.cancelOrder(orderId) - 应该失败

**预期结果**:
- 交易回退，错误信息："Not order owner"

**验证点**:
- 权限检查正确执行

**业务意义**: 防止恶意用户取消他人订单

---

#### 测试 6: 应该拒绝取消已完成的订单
**目的**: 验证订单状态验证

**前置条件**:
- 创建卖单并完全成交

**测试步骤**:
1. sellShares(100,000)
2. orderBook.fillOrder(orderId, 100,000) - 完全成交
3. cancelOrder(orderId) - 应该失败

**预期结果**:
- 交易回退，错误信息："Order not active"

**验证点**:
- 状态验证正确执行

**业务意义**: 防止取消已完成的订单

---

#### 测试 7: 应该拒绝取消已取消的订单
**目的**: 验证不能重复取消订单

**前置条件**:
- 创建卖单

**测试步骤**:
1. sellShares(100,000)
2. cancelOrder(orderId) - 第一次取消成功
3. cancelOrder(orderId) - 第二次取消应该失败

**预期结果**:
- 第二次取消回退，错误信息："Order not active"

**验证点**:
- 防止重复取消

**业务意义**: 确保订单状态的一致性

---

#### 测试 8: 应该拒绝在未设置 OrderBook 时取消订单
**目的**: 验证 OrderBook 依赖检查

**前置条件**:
- 部署新的 AssetToken，但不设置 OrderBook

**测试步骤**:
1. 创建新 AssetToken
2. 调用 cancelOrder(1) - 应该失败

**预期结果**:
- 交易回退，错误信息："OrderBook not set"

**验证点**:
- 依赖检查正确执行

**业务意义**: 确保合约依赖正确配置

---

#### 测试 9: 全部成交后取消订单应该不退还份额
**目的**: 验证完全成交订单无法取消

**前置条件**:
- 创建卖单并完全成交

**测试步骤**:
1. sellShares(100,000)
2. orderBook.fillOrder(orderId, 100,000)
3. 尝试 cancelOrder - 应该失败

**预期结果**:
- 交易回退（订单状态为 Filled，不是 Active）

**验证点**:
- 完全成交的订单无法取消

**业务意义**: 防止对已完成订单的非法操作

---

### 分组 2: cancelOrder 与分红/清算集成测试 (3 个)

#### 测试 10: 取消订单后，退还的份额应该可以继续提取期间的分红
**目的**: 验证取消订单后，退还的份额可以正确提取订单期间的分红

**前置条件**:
- seller 购买全部代币
- 创建卖单（200,000 份额）

**测试步骤**:
1. sellShares（内部调用 withdrawDividend，合并份额并减去出售份额）
2. 记录收益（订单创建后，3000 USDT）
3. 等待 2 天
4. cancelOrder（解除冻结，创建新 holderInfo 保留订单创建时间戳）
5. 等待 2 天
6. withdrawDividend 提取分红

**预期结果**:
- holderInfo[0]: 800,000 份额从订单创建时间到现在 = 80% * 3000 = 2400
- holderInfo[1]: 200,000 份额从订单创建时间到现在 = 20% * 3000 = 600
- 总计 = 3000 USDT

**验证点**:
- `received == revenue (3000 USDT)`

**业务意义**: 确保订单期间的分红正确归属给取消订单的用户

---

#### 测试 11: 取消订单后，退还的份额应该可以继续提取期间的清算金
**目的**: 验证取消订单后，退还的份额可以正确提取订单期间的清算金

**前置条件**:
- 存入抵押金（100,000 USDT）
- seller 购买全部代币
- 创建卖单（200,000 份额）

**测试步骤**:
1. 存入抵押金
2. sellShares（减去出售份额）
3. 触发清算（季度周期后）
4. 等待 1 天
5. cancelOrder（解除冻结，创建新 holderInfo）
6. 等待 2 天
7. withdrawDividend 提取清算金

**预期结果**:
- holderInfo[0]: 800,000 份额对应的清算金
- holderInfo[1]: 200,000 份额对应的清算金
- 总计 = 100,000 * 20% = 20,000 USDT（100%持有）

**验证点**:
- `received > 0`
- `received == expectedLiquidation (20,000 USDT)`

**业务意义**: 确保订单期间的清算金正确归属给取消订单的用户

---

#### 测试 12: 部分成交后取消，应该只退还未成交部分
**目的**: 验证部分成交场景的份额退还逻辑

**前置条件**:
- 创建卖单（100,000 份额）
- 部分成交（30,000 份额）

**测试步骤**:
1. sellShares(100,000)
2. orderBook.fillOrder(orderId, 30,000)
3. cancelOrder
4. 验证 holderInfo[1].shares == 70,000

**预期结果**:
- 仅退还未成交的 70,000 份额

**验证点**:
- `refundAmount == amount - filledAmount`

**业务意义**: 确保部分成交后取消的正确性

---

#### 测试 13: 零退还金额时应该不创建新的 holderInfo
**目的**: 验证完全成交订单尝试取消时的行为

**前置条件**:
- 创建卖单并完全成交

**测试步骤**:
1. sellShares(100,000)
2. orderBook.fillOrder(orderId, 100,000)
3. 尝试 cancelOrder - 应该失败

**预期结果**:
- 交易回退（无法取消已完成订单）

**验证点**:
- 完全成交后无法取消
- 不会创建新的 holderInfo

**业务意义**: 确保不会为 refundAmount = 0 创建无效的 holderInfo

---

## 四、测试覆盖范围总结

### 4.1 功能维度
- ✅ 基本取消订单流程
- ✅ 份额恢复逻辑
- ✅ 时间戳保留机制
- ✅ 部分成交处理
- ✅ 权限验证
- ✅ 状态验证
- ✅ 依赖检查
- ✅ 分红计算集成
- ✅ 清算金计算集成

### 4.2 边界条件
- ✅ 零退还金额
- ✅ 完全成交
- ✅ 部分成交
- ✅ 重复取消
- ✅ 未设置 OrderBook

### 4.3 权限控制
- ✅ 订单所有权验证
- ✅ 订单状态验证
- ✅ OrderBook 信任机制

### 4.4 业务场景
- ✅ 正常取消流程
- ✅ 部分成交后取消
- ✅ 时间戳保留与收益计算
- ✅ 复杂分红/清算场景

## 五、关键技术点

### 5.1 OrderBook 信任机制
- OrderBook 记录 assetToken 地址
- cancelOrder 检查：如果 `msg.sender == assetToken`，则信任其权限检查
- 否则验证 `order.seller == msg.sender`

### 5.2 时间戳保留逻辑
```solidity
holderInfo[msg.sender].push(
    HolderInfo({
        shares: refundAmount,
        holdingStartTime: INVALID_TIMESTAMP,
        lastDividendTime: orderLastDividendTime,  // 保留订单创建时间
        lastLiquidationClaimTime: orderLastLiquidationClaimTime  // 保留订单创建时间
    })
);
```

### 5.3 退还金额计算
```solidity
uint256 refundAmount = order.amount - order.filledAmount;
```

### 5.4 权限验证流程
```solidity
// AssetToken.cancelOrder
require(order.seller == msg.sender, "Not order owner");

// OrderBook.cancelOrder
if (msg.sender != assetToken) {
    require(order.seller == msg.sender, "Not order owner");
}
```

## 六、测试统计

| 类别 | 通过 | 跳过 | 失败 | 总计 |
|------|------|------|------|------|
| 基本功能 | 9 | 0 | 0 | 9 |
| 集成测试 | 4 | 0 | 0 | 4 |
| **总计** | **29** | **0** | **0** | **29** |

**注**: 总计29个通过是指整个 `AssetToken.sellShares.test.js` 文件的测试，包括 16 个 sellShares 测试 + 9 个 cancelOrder 基本测试 + 4 个 cancelOrder 集成测试。

## 七、已修复问题

### 问题 1: 分红重复计算 ✅ **已修复**
**原始现象**: `Insufficient available revenue`

**根本原因**:
- `sellShares` 冻结份额（`frozenAmounts += amount`）但**没有从 `holderInfo[0].shares` 中减去**
- 导致 `cancelOrder` 后出现份额重复：
  - `holderInfo[0].shares = 1,000,000`（未减去出售份额）
  - `holderInfo[1].shares = 200,000`（退还份额）
  - 总计 = 1,200,000 > 1,000,000（超过总供应量）
- `withdrawDividend` 计算分红时，两个 `holderInfo` 重复计算，导致尝试提取超过可用收益

**修复方案**:
1. **sellShares 中减去份额**:
   ```solidity
   // 在 sellShares 第5步添加
   info.shares -= amount;
   ```

2. **cancelOrder 中解除冻结**:
   ```solidity
   // 在 cancelOrder 第6步添加
   frozenAmounts[msg.sender] -= refundAmount;
   ```

**修复效果**: 
- sellShares 后：`holderInfo[0].shares = 800,000`，`frozenAmounts = 200,000`
- cancelOrder 后：`holderInfo[0].shares = 800,000`，`holderInfo[1].shares = 200,000`，`frozenAmounts = 0`
- 总计 = 1,000,000（正确）
- ✅ 所有分红/清算测试通过

### 问题 2: 清算金重复计算 ✅ **已修复**
**原始现象**: `Insufficient liquidatable collateral`

**根本原因**: 与问题 1 相同，份额重复计算导致清算金也被重复计算

**修复方案**: 与问题 1 相同

**修复效果**: ✅ 清算金测试通过

## 八、使用建议

### 8.1 取消订单最佳实践
1. 在订单未成交或部分成交时取消
2. 取消后可以重新创建新订单
3. 退还的份额保留原有的收益权利

### 8.2 注意事项
1. 已完全成交的订单无法取消
2. 取消订单后会创建新的 holderInfo 条目
3. 退还份额的时间戳保留订单创建时的值

### 8.3 集成要求
1. 必须正确设置 OrderBook 地址
2. OrderBook 必须设置 AssetToken 地址（信任机制）
3. 确保 withdrawDividend 逻辑正确处理多个 holderInfo 的收益计算

## 九、质量评估

### 9.1 测试质量
- ✅ 覆盖所有正常流程
- ✅ 覆盖主要异常场景
- ✅ 包含边界条件测试
- ✅ 复杂集成场景全部通过

### 9.2 代码健壮性
- ✅ 权限检查完善
- ✅ 状态验证严格
- ✅ 份额计算准确
- ✅ 收益计算正确（已修复重复计算问题）
- ✅ 冻结/解冻逻辑完整

### 9.3 业务完整性
- ✅ 基本取消流程完整
- ✅ 时间戳保留机制合理
- ✅ 复杂收益场景完善
- ✅ 支持部分成交后取消

## 十、更新历史

### v1.1 (2025-12-07)
- 🎉 **修复分红/清算重复计算问题**
- **合约修改**:
  - `sellShares`: 添加 `info.shares -= amount;`（第5步）
  - `cancelOrder`: 添加 `frozenAmounts[msg.sender] -= refundAmount;`（第6步）
- **测试修改**:
  - 更新"应该在创建卖单时合并所有份额"测试断言
  - 更新"取消订单后应该恢复份额"测试断言
- **结果**: ✅ 所有 29 个测试全部通过
- **文档更新**: 移除"待修复"标记，添加"已修复问题"章节

### v1.0 (2025-12-07)
- 初始版本
- 完成 cancelOrder 函数的 9 个基本测试用例
- 完成 4 个集成测试用例（2 个通过，2 个待修复）
- 总计 27 个测试通过
- 标记 2 个复杂场景测试为待修复状态

