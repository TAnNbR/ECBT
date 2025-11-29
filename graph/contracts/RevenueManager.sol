// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/IndexBitmap.sol";
//import "./interfaces/ICollateralVault.sol";

/**
 * @title RevenueManager
 * @notice 收益预言机 - 从指定API获取单个资产的收益数据
 * @dev Layer 5: 执行层 - 工具模块
 * 
 * 设计原则：
 * - 一个合约实例对应一个资产和一个API
 * - 由 AutomationKeeper 定期触发
 */
contract RevenueManager {
    using IndexBitmap for mapping(uint256 => uint256);

    // 时间截断类型枚举
    enum TimeUnit {
        MINUTE,  // 按分钟截断
        HOUR,    // 按小时截断
        DAY,     // 按天截断
        WEEK     // 按周截断
    }

    // 时间单位常量（秒）
    uint256 public constant MINUTE = 60;
    uint256 public constant HOUR = 3600;
    uint256 public constant DAY = 86400;
    uint256 public constant WEEK = 604800;
    
    // 时间单位（秒）- 用于时间截断
    uint256 public unitSeconds;

    // 累计收益映射表：时间戳 => 累计收益量（带精度）
    mapping(uint256 => uint256) internal revenueIndexBitmap;

    // 累计收益数据映射表结构
    mapping(uint256 => uint256) public accumulatedRevenueIndex;

    // 最后累计收益（带精度）
    uint256 public lastestAccumulatedRevenue;

    // CollateralVault 合约地址
    address public collateralVault;

    /**
     * @notice 设置时间单位
     * @param unit 时间单位（MINUTE/HOUR/DAY/WEEK）
     * @dev 根据枚举值设置 unitSeconds 状态变量
     */
    function setUnitSeconds(TimeUnit unit) public {
        if (unit == TimeUnit.MINUTE) {
            unitSeconds = MINUTE;
        } else if (unit == TimeUnit.HOUR) {
            unitSeconds = HOUR;
        } else if (unit == TimeUnit.DAY) {
            unitSeconds = DAY;
        } else if (unit == TimeUnit.WEEK) {
            unitSeconds = WEEK;
        } else {
            revert("Invalid time unit");
        }
    }

    /**
     * @notice 记录周期收益
     * @param periodRevenue 周期收益量（带精度）
     * @param timestamp 时间戳
     * @dev 自动累加收益、截断时间戳、设置位图索引、保存累计数据
     */
    function recordPeriodRevenue(
        uint256 periodRevenue,
        uint256 timestamp
    ) public {
        // 把收益额累加到 lastestAccumulatedRevenue 上
        lastestAccumulatedRevenue += periodRevenue;
        
        // 使用 truncateTimestampBySeconds 函数处理时间戳
        uint256 truncatedTimestamp = truncateTimestampBySeconds(timestamp);
        
        // 使用 revenueIndexBitmap.set() 方法，把处理后的时间戳作为参数传入
        revenueIndexBitmap.set(truncatedTimestamp);
        
        // 以处理后的时间戳为键，更新过的 lastestAccumulatedRevenue 为键值
        accumulatedRevenueIndex[truncatedTimestamp] = lastestAccumulatedRevenue;
        
        /*
        // 调用 CollateralVault 更新当前收益额
        if (collateralVault != address(0)) {
            ICollateralVault(collateralVault).updateCurrentRevenue(periodRevenue);
        }
        */
    }

    /**
     * @notice 时间截断函数 - 重载版本，直接传入秒数
     * @param timestamp 原始时间戳
     * @return 截断后的时间戳
     */
    function truncateTimestampBySeconds(
        uint256 timestamp
    ) internal view returns (uint256) {
        return timestamp - (timestamp % unitSeconds);
    }

    /**
     * @notice 查看某个时间戳是否已记录收益
     * @param timestamp 时间戳
     * @return 如果该时间戳已记录收益返回 true，否则返回 false
     */
    function isTimestampRecorded(uint256 timestamp) public view returns (bool) {
        return revenueIndexBitmap.isSet(timestamp);
    }

    /**
     * @notice 查看某个时间戳的累计收益
     * @param timestamp 时间戳
     * @return 该时间戳对应的累计收益（带精度）
     */
    function getAccumulatedRevenueAt(uint256 timestamp) public view returns (uint256) {
        return accumulatedRevenueIndex[timestamp];
    }

    /**
     * @notice 查看当前的累计总收益
     * @return 当前累计总收益（带精度）
     */
    function getCurrentAccumulatedRevenue() public view returns (uint256) {
        return lastestAccumulatedRevenue;
    }

    /**
     * @notice 查看当前时间单位设置（秒）
     * @return 当前时间单位（秒）
     */
    function getUnitSeconds() public view returns (uint256) {
        return unitSeconds;
    }

    /**
     * @notice 查找范围内被标记的最小索引
     * @param startIndex 起始索引
     * @param endIndex 结束索引
     * @return found 是否找到
     * @return minIndex 最小索引
     */
    function findMinMarkedIndex(
        uint256 startIndex,
        uint256 endIndex
    ) public view returns (bool found, uint256 minIndex) {
        return revenueIndexBitmap.findMinMarked(startIndex, endIndex);
    }
    
    /**
     * @notice 查找范围内被标记的最大索引
     * @param startIndex 起始索引
     * @param endIndex 结束索引
     * @return found 是否找到
     * @return maxIndex 最大索引
     */
    function findMaxMarkedIndex(
        uint256 startIndex,
        uint256 endIndex
    ) public view returns (bool found, uint256 maxIndex) {
        return revenueIndexBitmap.findMaxMarked(startIndex, endIndex);
    }

    /**
     * @notice 查找目标索引之前最近的被标记索引
     * @param targetIndex 目标索引
     * @return found 是否找到
     * @return previousIndex 之前最近的索引
     */
    function findPreviousMarkedIndex(
        uint256 targetIndex
    ) public view returns (bool found, uint256 previousIndex) {
        return revenueIndexBitmap.findPreviousMarked(targetIndex);
    }

    /**
     * @notice 计算两次分红之间的收益，判断是否跨区间
     * @param lastDividendTime 上次分红时间戳
     * @param claimTime 本次领取分红时间戳
     * @return inSameSlot 是否在同一个256位区间内
     * @return lastSlotIndex 上次分红时间所在的slot索引
     * @return claimSlotIndex 领取时间所在的slot索引
     * @return revenueDifference 期间收益差额（领取时收益 - 上次分红时收益）
     * @dev 位图每256个索引为一个slot，此函数判断两个时间是否跨slot
     */
    /*
    function calculateDividendRevenue(
        uint256 lastDividendTime,
        uint256 claimTime
    ) public view returns (
        bool inSameSlot,
        uint256 lastSlotIndex,
        uint256 claimSlotIndex,
        uint256 revenueDifference
    ) {
        require(claimTime >= lastDividendTime, "Claim time must be after last dividend time");
        
        // 截断时间戳
        uint256 truncatedLastTime = truncateTimestampBySeconds(lastDividendTime);
        uint256 truncatedClaimTime = truncateTimestampBySeconds(claimTime);
        
        // 计算各自所在的slot索引（每256个索引一个slot）
        lastSlotIndex = truncatedLastTime / 256;
        claimSlotIndex = truncatedClaimTime / 256;
        
        // 判断是否在同一个slot
        inSameSlot = (lastSlotIndex == claimSlotIndex);
        
        // 获取两个时间点的累计收益
        uint256 revenueAtLastDividend = accumulatedRevenueIndex[truncatedLastTime];
        uint256 revenueAtClaim = accumulatedRevenueIndex[truncatedClaimTime];
        
        // 如果领取时间的收益记录不存在，尝试找到之前最近的记录
        if (revenueAtClaim == 0 && !isTimestampRecorded(truncatedClaimTime)) {
            (bool found, uint256 previousIndex) = findPreviousMarkedIndex(truncatedClaimTime);
            if (found) {
                revenueAtClaim = accumulatedRevenueIndex[previousIndex];
            }
        }
        
        // 计算收益差额
        if (revenueAtClaim >= revenueAtLastDividend) {
            revenueDifference = revenueAtClaim - revenueAtLastDividend;
        } else {
            // 如果上次分红时间的记录不存在，使用0
            revenueDifference = revenueAtClaim;
        }
        
        return (inSameSlot, lastSlotIndex, claimSlotIndex, revenueDifference);
    }
    */

}
