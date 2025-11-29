# OrderBook - 链上限价订单交易系统 MVP

## 概述

这是一个为RWA资产代币（AssetToken）设计的链上限价订单簿系统，允许用户在保持合规性的前提下，通过限价单买卖资产代币份额。

## 核心功能

### 1. 创建卖单 (createSellOrder)
用户可以挂单出售自己的AssetToken，设置价格和过期时间。

**参数：**
- `amount`: 卖出数量（AssetToken数量，18位精度）
- `price`: 单价（用稳定币计价，18位精度，例如 1.5e18 = 1.5 USDT）
- `expiresIn`: 过期时间（秒，0表示永不过期）

**流程：**
1. 检查卖方身份验证和账户状态
2. 检查可用余额（排除冻结金额）
3. 将代币转入OrderBook合约托管
4. 创建订单并返回订单ID

**示例：**
```solidity
// 卖出100个AssetToken，单价2 USDT，24小时后过期
uint256 orderId = orderBook.createSellOrder(
    100e18,           // 100个代币
    2e18,             // 单价2 USDT
    86400             // 24小时
);
```

### 2. 购买订单 (fillOrder)
买方可以购买已挂单的AssetToken，支持部分成交。

**参数：**
- `orderId`: 订单ID
- `amount`: 购买数量

**流程：**
1. 检查订单状态和买方资格
2. 进行合规检查
3. 计算支付金额（包括手续费）
4. 转移稳定币和资产代币
5. 更新订单状态

**示例：**
```solidity
// 购买订单ID为1的订单，买入50个代币
// 需要先授权足够的USDT给OrderBook
usdt.approve(address(orderBook), 100e18);
orderBook.fillOrder(1, 50e18);
```

### 3. 取消订单 (cancelOrder)
卖方可以取消自己创建的订单。

**参数：**
- `orderId`: 订单ID

**流程：**
1. 验证调用者是订单所有者
2. 检查订单状态
3. 退还未成交的代币
4. 更新订单状态为已取消

**示例：**
```solidity
// 取消订单
orderBook.cancelOrder(1);
```

### 4. 批量取消订单 (batchCancelOrders)
一次性取消多个订单，节省Gas费用。

**示例：**
```solidity
uint256[] memory orderIds = new uint256[](3);
orderIds[0] = 1;
orderIds[1] = 2;
orderIds[2] = 3;
orderBook.batchCancelOrders(orderIds);
```

## 查询功能

### 获取订单详情
```solidity
Order memory order = orderBook.getOrder(orderId);
```

### 获取用户所有订单
```solidity
uint256[] memory myOrders = orderBook.getUserOrders(msg.sender);
```

### 获取活跃订单列表（分页）
```solidity
// 获取前10个活跃订单
(Order[] memory orders, uint256 total) = orderBook.getActiveOrders(0, 10);
```

### 获取订单剩余数量
```solidity
uint256 remaining = orderBook.getOrderRemainingAmount(orderId);
```

## 合规集成

OrderBook完全集成了AssetToken的合规系统：

1. **身份验证**: 买卖双方必须通过KYC验证
2. **账户冻结检查**: 冻结账户无法交易
3. **冻结金额限制**: 计入用户的冻结金额
4. **合规引擎**: 每笔交易都通过ComplianceEngine验证

## 手续费机制

- 手续费从买方支付的稳定币中扣除
- 手续费率以基点计算（10000 = 100%）
- 默认手续费率：30基点（0.3%）
- 手续费收集地址可配置
- 管理员可调整费率（最高10%）

**计算示例：**
```
购买数量: 100 AssetToken
单价: 2 USDT
总金额: 200 USDT
手续费(0.3%): 0.6 USDT
卖方收到: 199.4 USDT
```

## 订单状态

- `Active`: 活跃，可以成交
- `Filled`: 已完全成交
- `Cancelled`: 已取消
- `Expired`: 已过期

## 事件

系统会发出以下事件，方便前端监听和链下索引：

```solidity
// 订单创建
event OrderCreated(
    uint256 indexed orderId,
    address indexed seller,
    uint256 amount,
    uint256 price,
    uint256 expiresAt
);

// 订单成交
event OrderFilled(
    uint256 indexed orderId,
    address indexed buyer,
    uint256 filledAmount,
    uint256 remainingAmount,
    uint256 totalPayment
);

// 订单取消
event OrderCancelled(uint256 indexed orderId, uint256 refundedAmount);

// 订单过期
event OrderExpired(uint256 indexed orderId, uint256 refundedAmount);
```

## 完整使用流程

### 场景1: 卖方挂单卖出

```solidity
// 1. 卖方授权OrderBook操作AssetToken
assetToken.approve(address(orderBook), 100e18);

// 2. 创建卖单
uint256 orderId = orderBook.createSellOrder(
    100e18,    // 卖出100个代币
    2e18,      // 单价2 USDT
    86400      // 24小时后过期
);

// 3. 等待买方购买...
```

### 场景2: 买方购买

```solidity
// 1. 查看活跃订单
(Order[] memory orders, uint256 total) = orderBook.getActiveOrders(0, 10);

// 2. 选择订单并授权USDT
usdt.approve(address(orderBook), 200e18);  // 100个代币 * 2 USDT

// 3. 购买
orderBook.fillOrder(orderId, 100e18);
```

### 场景3: 部分成交

```solidity
// 订单总量: 100个代币
// 第一个买家买入60个
orderBook.fillOrder(orderId, 60e18);

// 检查剩余
uint256 remaining = orderBook.getOrderRemainingAmount(orderId);
// remaining = 40e18

// 第二个买家买完剩余的40个
orderBook.fillOrder(orderId, 40e18);

// 订单状态变为Filled
```

## 安全特性

1. **重入保护**: 所有关键函数使用ReentrancyGuard
2. **暂停机制**: 管理员可暂停交易
3. **权限控制**: 使用AccessControl管理管理员权限
4. **资金托管**: 代币由合约安全托管，管理员无法提取
5. **合规检查**: 每笔交易都经过完整的合规验证

## 部署参数

部署OrderBook合约需要以下参数：

```solidity
constructor(
    address _assetToken,      // AssetToken合约地址
    address _paymentToken,    // 支付代币地址（USDT/USDC等）
    address _feeCollector,    // 手续费收集地址
    uint256 _feeRate          // 手续费率（基点，30 = 0.3%）
)
```

## 管理功能

### 设置手续费率
```solidity
orderBook.setFeeRate(50);  // 设置为0.5%
```

### 设置手续费收集地址
```solidity
orderBook.setFeeCollector(newCollectorAddress);
```

### 暂停/恢复交易
```solidity
orderBook.pause();    // 暂停
orderBook.unpause();  // 恢复
```

## Gas优化建议

1. 批量取消订单使用`batchCancelOrders`
2. 分页查询活跃订单，避免一次加载过多数据
3. 前端缓存订单信息，监听事件更新
4. 使用合理的过期时间，让过期订单自动失效

## 限制和注意事项

1. **最大手续费**: 10%
2. **订单过期**: 需要有人调用`expireOrder`处理过期订单
3. **价格精度**: 18位小数，与ERC20标准一致
4. **分页查询**: 建议单次查询不超过50个订单
5. **部分成交**: 支持部分成交，买家可以多次购买同一订单

## 测试合约

项目包含以下Mock合约用于测试：

- `MockUSDT`: 测试用稳定币
- `MockIdentityRegistry`: 模拟身份注册表
- `MockComplianceEngine`: 模拟合规引擎
- `MockDividendModel`: 模拟分红模型

## 文件结构

```
contracts/
├── AssetToken.sol              # RWA资产代币
├── OrderBook.sol               # 订单簿合约
├── CollateralVault.sol         # 抵押金库
└── mocks/
    ├── MockUSDT.sol           # 测试稳定币
    ├── MockIdentityRegistry.sol
    ├── MockComplianceEngine.sol
    └── MockDividendModel.sol

interfaces/
├── IAssetToken.sol
├── IIdentityRegistry.sol
├── IComplianceEngine.sol
└── IDividendModel.sol
```

## 后续扩展方向

1. **限价买单**: 支持用户用稳定币挂单买入
2. **价格优先匹配**: 自动匹配最优价格
3. **订单聚合**: 一次买入匹配多个订单
4. **高级查询**: 按价格排序、筛选等
5. **预言机集成**: 参考市场价格
6. **链下索引**: 使用The Graph等工具索引事件

## 许可证

MIT License

