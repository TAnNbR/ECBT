// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LiquidationManager
 * @notice 清算管理器 - 管理抵押金清算流程
 * @dev Layer 4: 业务逻辑层
 * 
 * 清算流程：
 * 第1步: 健康度监控 - 当前抵押率 < 130%
 * 第2步: 触发清算 - 进入宽限期（7天）
 * 第3步: 分批清算 - 每批 20%，共5批
 * 第4步: 分配资金 - 优先级：分红 > 本金 > 罚金 > 返还
 */

interface IRevenueManager {
    function lastestAccumulatedRevenue() external view returns (uint256);
}

interface ICollateralVault {
    function getAvailableCollateral(address provider, address asset) external view returns (uint256);
    function updateLiquidatableCollateral(uint256 increasePercentage) external;
}

contract LiquidateManager {
    // 分红参数
    uint256 public quarterlyExpectedDividend;   // 季度预期分红金额
    uint256 public quarterCycleDays;            // 季度周期（天数）

    // 外部合约引用
    address public revenueManager;              // RevenueManager 合约地址
    address public collateralVault;             // CollateralVault 合约地址

    // 收益检查记录
    uint256[] public liquidationTimes;          // 清算时间记录数组（每次不达标时记录）
    uint256 public lastRecordedRevenue;         // 上次记录的累计收益
    uint256 public liquidatableCollateral;      // 可清算的抵押金额（20%）
    
    // 清算统计
    uint256 public liquidationCount;            // 执行清算的次数
    uint256 public lastCheckTime;               // 上次检查时间

    // 清算参数
    uint256 public constant LIQUIDATION_PERCENTAGE = 2000; // 20% (基点)

    // 事件
    event QuarterlyRevenueChecked(uint256 timestamp, bool meetsExpectation, uint256 actualRevenue, uint256 expectedRevenue);
    event LiquidationTriggered(uint256 timestamp, uint256 liquidationCount);
    event ConfigUpdated(string configName, uint256 value);

    /**
     * @notice 构造函数
     */
    constructor() {
        quarterCycleDays = 90; // 默认90天一个季度
    }

    /**
     * @notice 设置季度预期分红金额
     * @param _amount 预期分红金额
     */
    function setQuarterlyExpectedDividend(uint256 _amount) external {
        quarterlyExpectedDividend = _amount;
        emit ConfigUpdated("quarterlyExpectedDividend", _amount);
    }

    /**
     * @notice 设置季度周期天数
     * @param _days 天数
     */
    function setQuarterCycleDays(uint256 _days) external {
        require(_days > 0, "Days must be positive");
        quarterCycleDays = _days;
        emit ConfigUpdated("quarterCycleDays", _days);
    }

    /**
     * @notice 设置 RevenueManager 合约地址
     * @param _revenueManager 合约地址
     */
    function setRevenueManager(address _revenueManager) external {
        require(_revenueManager != address(0), "Invalid address");
        revenueManager = _revenueManager;
    }

    /**
     * @notice 设置 CollateralVault 合约地址
     * @param _collateralVault 合约地址
     */
    function setCollateralVault(address _collateralVault) external {
        require(_collateralVault != address(0), "Invalid address");
        collateralVault = _collateralVault;
    }

    /**
     * @notice 获取清算时间数组长度
     * @return 数组长度
     */
    function getLiquidationTimesLength() external view returns (uint256) {
        return liquidationTimes.length;
    }

    /**
     * @notice 获取指定索引的清算时间
     * @param index 索引
     * @return 清算时间戳
     */
    function getLiquidationTime(uint256 index) external view returns (uint256) {
        require(index < liquidationTimes.length, "Index out of bounds");
        return liquidationTimes[index];
    }

    /**
     * @notice 获取所有清算时间
     * @return 清算时间数组
     */
    function getAllLiquidationTimes() external view returns (uint256[] memory) {
        return liquidationTimes;
    }

    /**
     * @notice 检查季度收益是否达到预期
     * @dev 步骤：
     * 1. 调用 RevenueManager 查看 lastestAccumulatedRevenue
     * 2. 计算本季度实际收益并与预期收益比对
     * 3. 如果未达标，将 CollateralVault 中 20% 的押金列为可清算
     */
    function checkQuarterlyRevenue() external returns (bool meetsExpectation) {
        // 获取当前时间
        uint256 currentLiquidateTime = block.timestamp;
        
        // 检查是否到了季度周期
        require(
            currentLiquidateTime >= lastCheckTime + (quarterCycleDays * 1 days),
            "Quarter cycle not completed"
        );

        // 1. 从 RevenueManager 获取最新累计收益
        uint256 currentAccumulatedRevenue = IRevenueManager(revenueManager).lastestAccumulatedRevenue();

        // 2. 计算本季度实际收益 = 当前累计收益 - 上次记录的累计收益
        uint256 actualQuarterlyRevenue = currentAccumulatedRevenue - lastRecordedRevenue;

        // 3. 比对预期收益
        meetsExpectation = actualQuarterlyRevenue >= quarterlyExpectedDividend;

        // 触发检查完成事件
        emit QuarterlyRevenueChecked(
            currentLiquidateTime,
            meetsExpectation,
            actualQuarterlyRevenue,
            quarterlyExpectedDividend
        );

        // 4. 如果未达标，触发清算机制
        if (!meetsExpectation) {
            // 调用 CollateralVault 更新可清算押金金额，增加总押金的 20%
            ICollateralVault(collateralVault).updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);
            
            // 记录清算时间
            liquidationTimes.push(currentLiquidateTime);
            
            // 清算次数加 1
            liquidationCount++;

            // 触发清算事件
            emit LiquidationTriggered(currentLiquidateTime, liquidationCount);
        } 

        // 记录本次检查收益情况
        lastRecordedRevenue = currentAccumulatedRevenue;

        // 更新上次检查时间
        lastCheckTime = currentLiquidateTime;
        
        return meetsExpectation;
    }

    /**
     * @notice 查找持有期间内的清算次数
     * @param holdTime 持有时间（开始时间）
     * @param claimTime 取回清算份额的时间（结束时间）
     * @return count 持有期间内包含的清算时间戳数量（索引之差 + 1）
     * @dev 遍历 liquidationTimes 数组，计算持有期间 (holdTime, claimTime) 内的清算次数
     */
    function findLiquidationTimeRange(
        uint256 holdTime,
        uint256 claimTime
    ) external view returns (uint256 count) {
        // 遍历清算时间数组
        for (uint256 i = 0; i < liquidationTimes.length; i++) {
            uint256 liquidationTime = liquidationTimes[i];
            
            // 查找最小的大于 holdTime 的时间
            if (liquidationTime >= holdTime && liquidationTime <= claimTime) {
                count++;
            }
        }
    }

}
