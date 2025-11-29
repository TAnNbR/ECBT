# 合约修改记录

## 修改概述

根据新的合约交互逻辑要求进行了以下修改：

1. **Keeper 定期触发 RevenueOracle**，更新收益总额到 CollateralVault
2. **分红周期时 Keeper 触发 ExecutionEngine**，根据 CollateralVault 中的收益总额和 AssetToken 中的投资者份额计算分红

## 1. CollateralVault.sol 修改

### 1.1 新增数据结构

```solidity
// 收益记录
struct RevenueRecord {
    uint256 totalRevenue;           // 累计总收益
    uint256 lastDistributedRevenue; // 上次已分配的收益
    uint256 pendingRevenue;         // 待分配收益
    uint256 lastUpdateTime;         // 最后更新时间
}

// 资产 => 收益记录
mapping(address => RevenueRecord) public revenueRecords;
```

### 1.2 新增事件

```solidity
event RevenueUpdated(address indexed asset, uint256 newRevenue, uint256 totalRevenue);
event RevenueDistributed(address indexed asset, uint256 distributedAmount);
```

### 1.3 新增函数

#### updateRevenue - 更新资产收益（由 RevenueOracle 调用）
```solidity
function updateRevenue(
    address asset,
    uint256 newRevenue
) external onlyRole(ADMIN_ROLE) {
    require(asset != address(0), "Invalid asset");
    require(newRevenue > 0, "Revenue must be positive");

    RevenueRecord storage record = revenueRecords[asset];
    record.totalRevenue += newRevenue;
    record.pendingRevenue += newRevenue;
    record.lastUpdateTime = block.timestamp;

    emit RevenueUpdated(asset, newRevenue, record.totalRevenue);
}
```

#### markRevenueDistributed - 标记收益已分配（由 ExecutionEngine 调用）
```solidity
function markRevenueDistributed(
    address asset,
    uint256 distributedAmount
) external onlyRole(ADMIN_ROLE) {
    RevenueRecord storage record = revenueRecords[asset];
    require(distributedAmount <= record.pendingRevenue, "Exceeds pending revenue");

    record.lastDistributedRevenue = distributedAmount;
    record.pendingRevenue -= distributedAmount;

    emit RevenueDistributed(asset, distributedAmount);
}
```

#### getRevenueRecord - 获取资产收益记录
```solidity
function getRevenueRecord(
    address asset
) external view returns (RevenueRecord memory) {
    return revenueRecords[asset];
}
```

#### getPendingRevenue - 获取待分配收益
```solidity
function getPendingRevenue(
    address asset
) external view returns (uint256) {
    return revenueRecords[asset].pendingRevenue;
}
```

## 2. RevenueOracle.sol 修改

### 2.1 新增接口定义

```solidity
// CollateralVault接口
interface ICollateralVault {
    function updateRevenue(address asset, uint256 newRevenue) external;
}
```

### 2.2 新增状态变量

```solidity
// CollateralVault 地址
address public collateralVault;
```

### 2.3 构造函数修改

```solidity
constructor(
    address _asset, 
    string memory _apiEndpoint,
    address _collateralVault  // 新增参数
) {
    require(_asset != address(0), "Invalid asset");
    require(bytes(_apiEndpoint).length > 0, "Empty API endpoint");
    require(_collateralVault != address(0), "Invalid collateral vault");

    asset = _asset;
    apiEndpoint = _apiEndpoint;
    collateralVault = _collateralVault;

    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(ADMIN_ROLE, msg.sender);
    _grantRole(KEEPER_ROLE, msg.sender);
}
```

### 2.4 updateRevenue 函数修改

```solidity
function updateRevenue() external onlyRole(KEEPER_ROLE) nonReentrant {
    require(isDataValid(), "Data not valid or too old");

    // 获取最新收益数据
    uint256 newRevenue = latestRevenueData.revenue;

    // 更新本地累计收益
    totalRevenue += newRevenue;
    lastUpdateTime = block.timestamp;
    updateCount++;

    // 更新CollateralVault中的收益记录（新增）
    ICollateralVault(collateralVault).updateRevenue(asset, newRevenue);

    emit RevenueUpdated(
        newRevenue,
        totalRevenue,
        block.timestamp
    );
}
```

## 3. ExecutionEngine.sol 修改

### 3.1 新增接口定义

```solidity
// CollateralVault接口
interface ICollateralVault {
    struct RevenueRecord {
        uint256 totalRevenue;
        uint256 lastDistributedRevenue;
        uint256 pendingRevenue;
        uint256 lastUpdateTime;
    }
    
    function getRevenueRecord(address asset) external view returns (RevenueRecord memory);
    function getPendingRevenue(address asset) external view returns (uint256);
    function markRevenueDistributed(address asset, uint256 distributedAmount) external;
}

// AssetToken接口
interface IAssetToken {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function getHolders() external view returns (address[] memory);
}
```

### 3.2 新增状态变量

```solidity
address public collateralVault;     // 抵押金库
```

### 3.3 构造函数修改

```solidity
constructor(
    address _treasuryManager,
    address _platformTreasury,
    address _collateralVault  // 新增参数
) {
    require(_treasuryManager != address(0), "Invalid treasury manager");
    require(_platformTreasury != address(0), "Invalid platform treasury");
    require(_collateralVault != address(0), "Invalid collateral vault");

    treasuryManager = _treasuryManager;
    platformTreasury = _platformTreasury;
    collateralVault = _collateralVault;

    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(ADMIN_ROLE, msg.sender);
    _grantRole(KEEPER_ROLE, msg.sender);
    _grantRole(EXECUTOR_ROLE, msg.sender);
}
```

### 3.4 executeDividendDistribution 函数重构

**原函数签名**：
```solidity
function executeDividendDistribution(
    address asset,
    uint256 totalRevenue,  // 移除此参数
    address provider,
    address paymentToken
)
```

**新函数实现**：
```solidity
function executeDividendDistribution(
    address asset,
    address provider,
    address paymentToken
) external onlyRole(KEEPER_ROLE) nonReentrant returns (uint256) {
    require(asset != address(0), "Invalid asset");
    require(provider != address(0), "Invalid provider");
    require(paymentToken != address(0), "Invalid payment token");

    // 从CollateralVault获取待分配收益（新增）
    uint256 pendingRevenue = ICollateralVault(collateralVault).getPendingRevenue(asset);
    require(pendingRevenue > 0, "No pending revenue");

    // 创建分红ID
    distributionCounter++;
    uint256 distributionId = distributionCounter;

    // 计算分配金额
    uint256 investorPool = (pendingRevenue * INVESTOR_SHARE) / 10000;
    uint256 providerAmount = (pendingRevenue * PROVIDER_SHARE) / 10000;
    uint256 platformFee = (pendingRevenue * PLATFORM_FEE) / 10000;

    // 创建分红记录
    distributions[distributionId] = DividendDistribution({
        distributionId: distributionId,
        asset: asset,
        totalRevenue: pendingRevenue,
        investorPool: investorPool,
        providerAmount: providerAmount,
        platformFee: platformFee,
        timestamp: block.timestamp,
        executed: false
    });

    lastDistributionId[asset] = distributionId;

    // 自动计算投资者分红（新增）
    _autoCalculateInvestorDividends(distributionId, asset, investorPool);

    emit DividendDistributionCreated(
        distributionId,
        asset,
        pendingRevenue,
        investorPool,
        providerAmount,
        platformFee
    );

    return distributionId;
}
```

### 3.5 distributeDividends 函数修改

在函数末尾添加：
```solidity
// 标记为已执行
distribution.executed = true;

// 通知CollateralVault收益已分配（新增）
ICollateralVault(collateralVault).markRevenueDistributed(
    distribution.asset,
    distribution.totalRevenue
);

emit DistributionExecuted(distributionId, block.timestamp);
```

### 3.6 新增内部函数

```solidity
/**
 * @notice 内部函数：自动计算投资者分红
 * @param distributionId 分红ID
 * @param asset 资产地址（AssetToken）
 * @param investorPool 投资者池总额
 */
function _autoCalculateInvestorDividends(
    uint256 distributionId,
    address asset,
    uint256 investorPool
) private {
    IAssetToken assetToken = IAssetToken(asset);
    
    // 获取所有持有者
    address[] memory holders = assetToken.getHolders();
    uint256 totalSupply = assetToken.totalSupply();
    
    require(totalSupply > 0, "No tokens in circulation");
    
    // 计算每个持有者的分红
    for (uint256 i = 0; i < holders.length; i++) {
        address holder = holders[i];
        uint256 balance = assetToken.balanceOf(holder);
        
        if (balance > 0) {
            uint256 dividendAmount = (investorPool * balance) / totalSupply;
            
            investorDividends[distributionId][holder] = InvestorDividend({
                investor: holder,
                amount: dividendAmount,
                claimed: false
            });
            
            distributionInvestors[distributionId].push(holder);
            
            emit DividendCalculated(distributionId, holder, dividendAmount);
        }
    }
}
```

## 工作流程总结

### 收益更新流程
1. Keeper 定期触发 `RevenueOracle.fetchRevenue()` 获取链下收益数据
2. Keeper 调用 `RevenueOracle.updateRevenue()` 更新收益
3. RevenueOracle 自动调用 `CollateralVault.updateRevenue()` 同步收益到金库
4. CollateralVault 记录累计收益和待分配收益

### 分红执行流程
1. 到达分红周期（月度/季度）时，Keeper 触发 `ExecutionEngine.executeDividendDistribution()`
2. ExecutionEngine 从 CollateralVault 获取待分配收益
3. ExecutionEngine 从 AssetToken 获取所有持有者和份额信息
4. 自动计算每个投资者应得分红（基于持有份额比例）
5. 执行 `distributeDividends()` 分发资金给投资者、提供者和平台
6. 分配完成后，调用 `CollateralVault.markRevenueDistributed()` 标记收益已分配

### 关键改进
- **数据集中管理**：收益数据在 CollateralVault 中集中管理
- **自动化计算**：ExecutionEngine 自动从 AssetToken 获取份额信息计算分红
- **清晰的职责分离**：
  - RevenueOracle：获取和更新收益数据
  - CollateralVault：管理收益记录
  - AssetToken：管理投资者份额
  - ExecutionEngine：执行分红分配
