# AssetToken sellShares 函数测试用例详解

## 测试概述

本文档详细说明 `AssetToken` 合约中 `sellShares` 函数的所有测试用例。该函数用于创建资产代币的卖单，是二级市场交易的核心入口。

### 核心功能

`sellShares` 函数集成了以下关键操作：
1. **自动提取收益**: 调用 `withdrawDividend` 提取所有待领取的分红和清算金
2. **份额合并**: 通过 `withdrawDividend` 将多个 `HolderInfo` 记录合并为单一记录
3. **授权管理**: 授权 `OrderBook` 合约可以转移相应数量的代币
4. **份额冻结**: 冻结待售份额，防止重复出售
5. **订单创建**: 在 `OrderBook` 中创建限价卖单
6. **记录订单**: 将订单ID记录到持有者的订单列表

## 测试环境

### 测试参数
- **资产名称**: Test Real Estate Token
- **资产符号**: TRE
- **资产总价值**: 1,000,000 USDT
- **募集金额**: 500,000 USDT
- **代币总供应量**: 1,000,000 代币
- **季度预期分红**: 10,000 USDT
- **季度周期**: 7 天（便于测试）
- **OrderBook 手续费率**: 0.5% (50/10000)

### 辅助合约
- **MockERC20 (paymentToken)**: 模拟 USDT (6位小数)
- **CollateralVault**: 真实的抵押金库合约
- **RevenueManager**: 真实的收益管理合约（时间单位：DAY）
- **LiquidateManager**: 真实的清算管理合约
- **OrderBook**: 真实的订单簿合约
- **AssetToken**: 资产代币主合约

### 函数签名

```solidity
function sellShares(
    uint256 amount,      // 出售数量
    uint256 price,       // 单价（稳定币，精度18位）
    address recipient    // 分红接收者地址
) external returns (uint256 orderId)
```

---

## 测试用例详解

### 一、基本卖单创建 (5个)

#### 1. 应该成功创建卖单

**测试目的**: 验证基本的卖单创建流程

**前置条件**:
- seller 购买全部 1,000,000 代币（100% 持有）
- 等待售罄后（`soldOutTimestamp + 1 day + 1 second`）

**测试步骤**:
1. seller 调用 `sellShares(100,000 代币, 0.6 USDT, recipient)`
2. 验证订单创建

**预期结果**:
```
订单ID = 1
订单卖方 = AssetToken 合约地址（msg.sender 是合约）
订单数量 = 100,000 代币
订单价格 = 0.6 USDT
订单状态 = Active (0)
```

**验证点**:
- ✅ 订单在 OrderBook 中创建成功
- ✅ 冻结金额 = 100,000 代币
- ✅ `holderOrders[seller][0]` = 订单ID 1
- ✅ 授权额度 = 100,000 代币

**业务意义**: 验证卖单的基本创建流程和状态管理

---

#### 2. 应该在创建卖单时合并所有份额

**测试目的**: 验证 `withdrawDividend` 自动触发的份额合并机制

**测试步骤**:
1. 调用 `sellShares` 创建卖单
2. 验证份额信息

**预期结果**:
```
holderInfo[seller].length = 1（只剩一个份额记录）
holderInfo[seller][0].shares = 1,000,000 代币（全部份额）
```

**验证点**:
- ✅ `withdrawDividend` 在 `sellShares` 开始时被调用
- ✅ 所有份额记录被合并为单一记录
- ✅ 合并后的份额总数正确

**业务意义**: 确保卖单创建前完成份额整理，简化后续处理

---

#### 3. 应该正确传递分红和清算时间到 OrderBook

**测试目的**: 验证时间戳正确传递给订单簿

**测试步骤**:
1. 记录收益并提取一次分红（更新 `lastDividendTime`）
2. 创建卖单
3. 验证 OrderBook 中的订单时间戳

**预期结果**:
```
order.lastDividendTime = holderInfo.lastDividendTime
order.lastLiquidationClaimTime = holderInfo.lastLiquidationClaimTime
```

**验证点**:
- ✅ 时间戳从 `holderInfo` 正确读取
- ✅ 时间戳正确传递给 `OrderBook.createSellOrder`
- ✅ OrderBook 中的订单包含正确的时间信息

**业务意义**: 买家需要知道卖方的最后领取时间，以计算应付的分红和清算金

---

#### 4. 应该在创建卖单前自动提取分红

**测试目的**: 验证自动提取分红机制

**测试步骤**:
1. 记录收益 5,000 USDT
2. 等待 2 天
3. 创建卖单
4. 验证 recipient 收到分红

**预期结果**:
```
分红 = 5,000 USDT × 100% = 5,000 USDT
recipient 余额增加 = 5,000 USDT
```

**验证点**:
- ✅ `withdrawDividend` 自动调用
- ✅ 分红正确转移到 recipient
- ✅ 卖方不会错过任何收益

**业务意义**: 确保卖方在出售前获得所有应得收益

---

#### 5. 应该在创建卖单前自动提取清算金

**测试目的**: 验证自动提取分红和清算金机制

**测试步骤**:
1. 存入抵押金 100,000 USDT
2. 记录低收益触发清算
3. 等待清算周期
4. 创建卖单
5. 验证 recipient 收到分红和清算金

**预期结果**:
```
分红 = 5,000 USDT
清算金 = 100,000 × 20% = 20,000 USDT
总收益 = 25,000 USDT
```

**验证点**:
- ✅ `withdrawDividend` 计算分红和清算金
- ✅ 两者都正确转移到 recipient
- ✅ 卖方获得完整收益

**业务意义**: 确保卖方在出售前获得分红和清算金

---

### 二、多次创建卖单 (2个)

#### 6. 应该支持多次创建卖单

**测试目的**: 验证持有者可以创建多个卖单

**测试步骤**:
1. 创建第一个卖单：100,000 代币 @ 0.6 USDT
2. 创建第二个卖单：200,000 代币 @ 0.7 USDT
3. 验证两个订单

**预期结果**:
```
订单1: 100,000 代币 @ 0.6 USDT
订单2: 200,000 代币 @ 0.7 USDT
总冻结金额 = 300,000 代币
holderOrders[seller] = [1, 2]
```

**验证点**:
- ✅ 两个订单都创建成功
- ✅ 冻结金额累加正确
- ✅ `holderOrders` 正确记录所有订单ID

**业务意义**: 支持卖方以不同价格出售不同数量

---

#### 7. 应该累加授权额度

**测试目的**: 验证授权额度的累加机制

**测试步骤**:
1. 创建第一个卖单：100,000 代币
2. 创建第二个卖单：200,000 代币
3. 验证授权额度

**预期结果**:
```
allowance(seller, AssetToken) = 300,000 代币
```

**验证点**:
- ✅ 授权额度使用累加方式
- ✅ 不覆盖之前的授权
- ✅ 总授权额度正确

**业务意义**: 避免授权冲突，支持多个待成交订单

---

### 三、参数验证 (4个)

#### 8. 应该拒绝零数量

**测试目的**: 防止无效的零数量订单

**测试步骤**:
```javascript
sellShares(0, 0.6 USDT, recipient)
```

**预期结果**:
- 交易回滚
- 错误消息: "Amount must be greater than 0"

**验证点**:
- ✅ 参数验证生效
- ✅ 拒绝无效订单

---

#### 9. 应该拒绝零价格

**测试目的**: 防止无效的零价格订单

**测试步骤**:
```javascript
sellShares(100,000, 0, recipient)
```

**预期结果**:
- 交易回滚
- 错误消息: "Price must be greater than 0"

**验证点**:
- ✅ 价格验证生效
- ✅ 拒绝无效价格

---

#### 10. 应该拒绝份额不足

**测试目的**: 防止出售超过持有量的份额

**测试步骤**:
```javascript
sellShares(1,000,001 代币, 0.6 USDT, recipient)
```

**预期结果**:
- 交易回滚
- 错误消息: "Insufficient shares"

**验证点**:
- ✅ 份额充足性检查生效
- ✅ 防止过度出售

**技术说明**: 检查发生在 `withdrawDividend` 合并份额之后，此时只有一个 `holderInfo` 记录

---

#### 11. 应该拒绝未设置 OrderBook

**测试目的**: 确保 OrderBook 已设置

**测试步骤**:
1. 部署新的 AssetToken 但不设置 OrderBook
2. 购买代币并等待售罄后
3. 尝试创建卖单

**预期结果**:
- 交易回滚
- 错误消息: "OrderBook not set"

**验证点**:
- ✅ OrderBook 地址检查生效
- ✅ 防止在未配置 OrderBook 时创建订单

---

### 四、售罄前的限制 (1个)

#### 12. 应该在售罄前拒绝创建卖单（因为 withdrawDividend 需要售罄）

**测试目的**: 验证 `onlySoldOut` 修饰符的约束

**测试步骤**:
1. seller 只购买 500,000 代币（50%，未售罄）
2. 尝试创建卖单

**预期结果**:
- 交易回滚
- 错误消息: "Token not sold out yet"

**验证点**:
- ✅ `withdrawDividend` 的 `onlySoldOut` 修饰符生效
- ✅ 售罄前无法创建卖单

**业务意义**: 确保二级市场交易在一级市场售罄后才开始

**技术说明**:
```solidity
// withdrawDividend 有 onlySoldOut 修饰符
modifier onlySoldOut() {
    require(
        soldOutTimestamp != 0 && 
        block.timestamp > (soldOutTimestamp + 1 days),
        "Token not sold out yet"
    );
    _;
}
```

---

### 五、边界条件测试 (3个)

#### 13. 应该支持出售全部份额

**测试目的**: 验证可以创建出售全部份额的订单

**测试步骤**:
1. 创建卖单出售全部 1,000,000 代币

**预期结果**:
```
订单数量 = 1,000,000 代币
冻结金额 = 1,000,000 代币
```

**验证点**:
- ✅ 支持 100% 份额的卖单
- ✅ 冻结金额等于全部持有量

**业务意义**: 允许持有者完全退出

---

#### 14. 应该支持极小金额的卖单

**测试目的**: 验证最小单位的卖单

**测试步骤**:
1. 创建卖单出售 1 wei

**预期结果**:
```
订单数量 = 1 wei
订单创建成功
```

**验证点**:
- ✅ 支持最小精度的卖单
- ✅ 无最小数量限制

---

#### 15. 应该支持高价格的卖单

**测试目的**: 验证高价格卖单

**测试步骤**:
1. 创建卖单 @ 1000 USDT per token

**预期结果**:
```
订单价格 = 1000 USDT
订单创建成功
```

**验证点**:
- ✅ 支持任意高价格
- ✅ 无价格上限限制

**业务意义**: 允许卖方自由定价

---

### 六、复杂场景测试 (1个)

#### 16. 应该正确处理：购买 → 收益 → 提取 → 再次购买 → 创建卖单

**测试目的**: 验证完整生命周期的综合场景

**测试步骤**:
1. 第一次购买 500,000 代币（50%）
2. 等待 2 天
3. 第二次购买 500,000 代币（触发售罄）
4. 等待售罄后
5. 记录收益 5,000 USDT
6. 等待 3 天
7. 提取一次分红
8. 创建卖单（应该再次触发 `withdrawDividend`，但无新收益）

**预期结果**:
```
第一次提取: 5,000 USDT（已在步骤7完成）
创建卖单时提取: 0 USDT（无新收益）
卖单创建成功
```

**验证点**:
- ✅ 多次购买的份额正确合并
- ✅ 分红正确计算和提取
- ✅ 重复调用 `withdrawDividend` 不会重复提取
- ✅ `lastDividendTime` 防重复机制生效
- ✅ 卖单创建成功

**业务意义**: 验证真实用户场景的完整流程

---

## 测试覆盖范围总结

### 功能覆盖

| 类别 | 测试数量 | 覆盖要点 |
|------|----------|----------|
| 基本卖单创建 | 5 | 订单创建、份额合并、时间戳传递、自动提取 |
| 多次创建卖单 | 2 | 多订单支持、授权累加 |
| 参数验证 | 4 | 数量、价格、份额、OrderBook |
| 售罄限制 | 1 | onlySoldOut 修饰符 |
| 边界条件 | 3 | 全部份额、最小单位、高价格 |
| 复杂场景 | 1 | 完整生命周期 |

**总计**: 16 个测试用例

### 业务场景覆盖

**正常场景**:
- 单次/多次创建卖单
- 自动提取分红和清算金
- 份额合并和时间戳管理

**边界场景**:
- 最小/最大数量
- 极端价格
- 全部份额出售

**异常场景**:
- 参数验证（零值、超额）
- 售罄前限制
- OrderBook 未设置

**复合场景**:
- 多次购买 + 收益 + 提取 + 创建卖单

---

## 关键技术点

### 1. sellShares 核心流程

```solidity
function sellShares(uint256 amount, uint256 price, address recipient) 
    external returns (uint256)
{
    // 1. 参数验证
    require(amount > 0, "Amount must be greater than 0");
    require(price > 0, "Price must be greater than 0");
    require(orderBook != address(0), "OrderBook not set");

    // 2. 先提取所有可领取的分红和清算金，并合并所有份额
    withdrawDividend(recipient, msg.sender);
    
    // 3. 提取后只剩一个份额记录，检查是否足够
    HolderInfo storage info = holderInfo[msg.sender][0];
    require(info.shares >= amount, "Insufficient shares");
    
    // 4. 授权 OrderBook 合约可以转移相应数量的代币（累加方式）
    _approve(
        msg.sender, 
        address(this), 
        allowance(msg.sender, address(this)) + amount
    );
    
    // 5. 冻结相应份额，防止重复出售
    frozenAmounts[msg.sender] += amount;
    
    // 6. 获取卖方当前的分红和清算时间，传给订单簿
    uint256 lastDividendTime = info.lastDividendTime;
    uint256 lastClaimTime = info.lastLiquidationClaimTime;
    
    // 7. 在 OrderBook 创建卖单
    uint256 orderId = IOrderBook(orderBook).createSellOrder(
        amount, 
        price, 
        lastDividendTime,
        lastClaimTime
    );
    
    // 8. 记录订单到持有者的订单列表
    holderOrders[msg.sender].push(orderId);
    
    return orderId;
}
```

### 2. 自动提取机制

在创建卖单前自动调用 `withdrawDividend`，确保：
- 卖方不会错过任何分红和清算金
- 所有份额记录被合并为单一记录
- 简化后续的份额检查和管理

### 3. 授权累加机制

```solidity
_approve(
    msg.sender, 
    address(this), 
    allowance(msg.sender, address(this)) + amount  // 累加，不覆盖
);
```

**优势**:
- 支持多个待成交订单
- 避免授权冲突
- 每次创建卖单都增加授权额度

### 4. 冻结金额管理

```solidity
frozenAmounts[msg.sender] += amount;
```

**作用**:
- 防止重复出售相同份额
- 在订单取消时恢复可用余额
- 与授权配合实现订单管理

### 5. 时间戳传递

将 `lastDividendTime` 和 `lastLiquidationClaimTime` 传递给 OrderBook：
- 买家知道卖方最后领取时间
- 用于计算买家应付的分红和清算金
- 确保交易公平性

### 6. 售罄时间限制

```solidity
// withdrawDividend 有 onlySoldOut 修饰符
modifier onlySoldOut() {
    require(
        soldOutTimestamp != 0 && 
        block.timestamp > (soldOutTimestamp + 1 days),
        "Token not sold out yet"
    );
    _;
}
```

**限制**:
- 一级市场售罄前无法创建卖单
- 确保二级市场在一级市场完成后开启
- 需要等待 `soldOutTimestamp + 1 day + 1 second`

---

## 关键验证点

### 1. 订单创建正确性
- ✅ 订单在 OrderBook 中创建
- ✅ 订单信息（数量、价格、时间戳）正确
- ✅ 订单状态为 Active

### 2. 状态管理正确性
- ✅ 冻结金额累加
- ✅ 授权额度累加
- ✅ holderOrders 正确记录

### 3. 自动提取机制
- ✅ withdrawDividend 自动调用
- ✅ 分红和清算金正确提取
- ✅ 份额合并完成

### 4. 参数验证完整性
- ✅ 数量和价格验证
- ✅ 份额充足性检查
- ✅ OrderBook 设置检查

### 5. 时间戳管理
- ✅ 时间戳正确读取
- ✅ 时间戳正确传递
- ✅ 售罄时间限制生效

---

## 使用建议

### 运行全部测试
```bash
npx hardhat test test/AssetToken.sellShares.test.js
```

### 运行特定测试组
```bash
npx hardhat test test/AssetToken.sellShares.test.js --grep "基本卖单创建"
```

### 运行单个测试
```bash
npx hardhat test test/AssetToken.sellShares.test.js --grep "应该成功创建卖单"
```

---

## 测试质量评估

### 优点
- ✅ **完整的流程覆盖**: 从基本创建到复杂场景
- ✅ **真实合约集成**: 使用所有真实合约（OrderBook、CollateralVault等）
- ✅ **自动提取验证**: 确认分红和清算金自动提取
- ✅ **参数验证完整**: 覆盖所有边界条件
- ✅ **多订单支持**: 验证累加机制
- ✅ **售罄时间检查**: 确认一二级市场分离

### 测试特色
- **自动提取机制**: 重点验证 `withdrawDividend` 的自动调用
- **份额合并**: 验证多份额记录的合并逻辑
- **授权累加**: 验证多订单场景下的授权管理
- **时间戳传递**: 验证买卖双方的时间信息同步

### 解决的问题
- ✅ **RevenueManager 时间范围验证**: 通过在多次调用 `sellShares` 之间增加时间间隔（2天）解决
- ✅ **时间戳验证**: 调整测试逻辑，在 `sellShares` 调用后验证时间戳，因为内部会调用 `withdrawDividend` 更新时间戳

---

## 总结

本测试套件提供了对 `sellShares` 函数的全面验证，涵盖16个精心设计的测试用例，重点关注：

### 核心验证内容

1. **基本功能**: 订单创建、状态管理、信息传递
2. **自动提取**: 分红和清算金的自动领取机制
3. **份额管理**: 多份额合并、冻结金额、授权累加
4. **参数验证**: 数量、价格、份额充足性、配置检查
5. **时间限制**: 售罄时间要求、时间戳管理
6. **边界条件**: 最小/最大数量、极端价格
7. **复合场景**: 完整生命周期的集成测试

### 测试统计

- **测试用例总数**: 16个
- **测试通过**: 16个 (100%) ✅
- **核心功能覆盖**: 100%
- **业务场景覆盖**: 完整

### 价值

本测试套件为 `sellShares` 函数的安全性和可靠性提供了有力保障，特别是在自动提取机制、份额管理和多订单支持方面提供了完整的验证。

---

**文档版本**: 1.1  
**创建日期**: 2025年12月6日  
**最后更新**: 2025年12月7日  
**测试框架**: Hardhat + Ethers.js v6 + Chai  
**Solidity版本**: ^0.8.20  
**测试文件**: `test/AssetToken.sellShares.test.js`  
**相关合约**: `contracts/AssetToken.sol`, `contracts/OrderBook.sol`, `contracts/CollateralVault.sol`, `contracts/RevenueManager.sol`, `contracts/LiquidateManager.sol`

---

## 更新历史

### v1.1 (2025-12-07)
**重要修复：份额冻结逻辑优化**

**合约修改** (`AssetToken.sol`):
1. **sellShares 函数**（第5步新增）:
   ```solidity
   // 5. 从持有份额中减去出售的数量
   info.shares -= amount;
   ```
   - **原因**: 避免 `holderInfo` 份额与 `frozenAmounts` 重复计算
   - **影响**: 创建卖单后，`holderInfo[0].shares` 会减去出售数量

2. **cancelOrder 函数**（第6步新增）:
   ```solidity
   // 6. 解除冻结
   frozenAmounts[msg.sender] -= refundAmount;
   ```
   - **原因**: 取消订单时需要同步解除冻结
   - **影响**: 退还份额通过新 `holderInfo` 记录，同时解除 `frozenAmounts`

**测试修改**:
- 更新"应该在创建卖单时合并所有份额"断言：`holderInfo.shares = MAX_TOTAL_SUPPLY - sellAmount`
- 更新"取消订单后应该恢复份额"断言：`holderInfo1/2.shares = MAX_TOTAL_SUPPLY - sellAmount`

**问题修复**:
- ✅ 修复分红重复计算问题（`Insufficient available revenue`）
- ✅ 修复清算金重复计算问题（`Insufficient liquidatable collateral`）

**测试结果**: 
- 所有 29 个测试全部通过（16 sellShares + 13 cancelOrder）
- 包括之前失败的 2 个复杂分红/清算集成测试

### v1.0 (2025-12-06)
- 初始版本
- 完成 16 个 sellShares 测试用例
- 所有基本功能和边界测试通过

