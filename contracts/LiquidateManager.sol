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

    // 清算参数
    uint256 public constant LIQUIDATION_PERCENTAGE = 2000; // 20% (基点)

    /**
     * @notice 检查季度收益是否达到预期
     * @param provider 资产提供者地址
     * @param asset 资产地址
     * @dev 步骤：
     * 1. 调用 RevenueManager 查看 lastestAccumulatedRevenue
     * 2. 计算本季度实际收益并与预期收益比对
     * 3. 如果未达标，将 CollateralVault 中 20% 的押金列为可清算
     */
    function checkQuarterlyRevenue(
        address provider,
        address asset
    ) external returns (bool meetsExpectation) {
        // 获取上次检查时间（数组最后一个元素，如果数组为空则为 0）
        uint256 lastCheckTime = liquidationTimes.length > 0 
            ? liquidationTimes[liquidationTimes.length - 1] 
            : 0;
        
        // 检查是否到了季度周期
        require(
            block.timestamp >= lastCheckTime + (quarterCycleDays * 1 days),
            "Quarter cycle not completed"
        );

        // 1. 从 RevenueManager 获取最新累计收益
        uint256 currentAccumulatedRevenue = IRevenueManager(revenueManager).lastestAccumulatedRevenue();

        // 2. 计算本季度实际收益 = 当前累计收益 - 上次记录的累计收益
        uint256 actualQuarterlyRevenue = currentAccumulatedRevenue - lastRecordedRevenue;

        // 3. 比对预期收益
        meetsExpectation = actualQuarterlyRevenue >= quarterlyExpectedDividend;

        // 4. 如果未达标，触发清算机制
        if (!meetsExpectation) {
            // 调用 CollateralVault 更新可清算押金金额，增加总押金的 20%
            ICollateralVault(collateralVault).updateLiquidatableCollateral(LIQUIDATION_PERCENTAGE);
            
            // 记录清算时间
            liquidationTimes.push(block.timestamp);
            
            // 清算次数加 1
            liquidationCount++;
        } 

        // 记录本次检查收益情况
        lastRecordedRevenue = currentAccumulatedRevenue;
        
        return meetsExpectation;
    }

    /**
     * @notice 查找持有期间内的清算次数
     * @param holdTime 持有时间（开始时间）
     * @param claimTime 取回清算份额的时间（结束时间）
     * @return count 持有期间内包含的清算时间戳数量（索引之差 + 1）
     * @return foundFirst 是否找到第一个清算时间
     * @return foundLast 是否找到最后一个清算时间
     * @dev 遍历 liquidationTimes 数组，计算持有期间 (holdTime, claimTime) 内的清算次数
     */
    function findLiquidationTimeRange(
        uint256 holdTime,
        uint256 claimTime
    ) external view returns (
        uint256 count,
        bool foundFirst,
        bool foundLast
    ) {
        // 初始化
        uint256 firstLiquidationTime = type(uint256).max;   // 用于找最小值（内部变量）
        uint256 lastLiquidationTime = 0;                    // 用于找最大值（内部变量）
        uint256 firstIndex = 0;                             // 第一个清算时间的索引
        uint256 lastIndex = 0;                              // 最后一个清算时间的索引
        foundFirst = false;
        foundLast = false;

        // 遍历清算时间数组
        for (uint256 i = 0; i < liquidationTimes.length; i++) {
            uint256 liquidationTime = liquidationTimes[i];
            
            // 查找最小的大于 holdTime 的时间
            if (liquidationTime > holdTime && liquidationTime < firstLiquidationTime) {
                firstLiquidationTime = liquidationTime;
                firstIndex = i;
                foundFirst = true;
            }
            
            // 查找最大的小于 claimTime 的时间
            if (liquidationTime < claimTime && liquidationTime > lastLiquidationTime) {
                lastLiquidationTime = liquidationTime;
                lastIndex = i;
                foundLast = true;
            }
        }

        // 计算包含的时间戳数量（索引之差 + 1）
        // 只有当两个都找到时才计算
        if (foundFirst && foundLast) {
            count = lastIndex >= firstIndex ? (lastIndex - firstIndex + 1) : 0;
        } else {
            count = 0;
        }

        return (count, foundFirst, foundLast);
    }

}
