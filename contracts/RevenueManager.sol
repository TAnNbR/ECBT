// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/IndexBitmap.sol";
import "./interfaces/ICollateralVault.sol";

/**
 * @title RevenueManager
 * @notice 收益预言机 - 从指定API获取单个资产的收益数据
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

    // 收益时间查询表
    mapping(uint256 => uint256) internal revenueIndexBitmap;

    // 累计收益表：时间戳 => 累计收益量（带精度）
    mapping(uint256 => uint256) public accumulatedRevenueIndex;

    // 最后累计收益（带精度）
    uint256 public lastestAccumulatedRevenue;

    // CollateralVault 合约地址
    address public collateralVault;

    /**
     * @notice 设置 CollateralVault 合约地址
     * @param _collateralVault CollateralVault 合约地址
     */
    function setCollateralVault(address _collateralVault) public {
        require(_collateralVault != address(0), "Invalid collateral vault address");
        collateralVault = _collateralVault;
    }

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
        
        // 调用 CollateralVault 更新当前收益额
        if (collateralVault != address(0)) {
            ICollateralVault(collateralVault).updateCurrentRevenue(periodRevenue);
        }

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
        // 对传入的时间戳进行截断，以匹配存储时的截断方式
        uint256 truncatedStart = truncateTimestampBySeconds(startIndex);
        uint256 truncatedEnd = truncateTimestampBySeconds(endIndex);
        return revenueIndexBitmap.findMinMarked(truncatedStart, truncatedEnd);
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
        // 对传入的时间戳进行截断，以匹配存储时的截断方式
        uint256 truncatedStart = truncateTimestampBySeconds(startIndex);
        uint256 truncatedEnd = truncateTimestampBySeconds(endIndex);
        return revenueIndexBitmap.findMaxMarked(truncatedStart, truncatedEnd);
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
     * @notice 时间截断函数 - 重载版本，直接传入秒数
     * @param timestamp 原始时间戳
     * @return 截断后的时间戳
     */
    function truncateTimestampBySeconds(
        uint256 timestamp
    ) public view returns (uint256) {
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

}
