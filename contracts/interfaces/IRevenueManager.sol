// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRevenueManager
 * @notice 收益管理接口
 */
interface IRevenueManager {
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
    ) external view returns (bool found, uint256 minIndex);

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
    ) external view returns (bool found, uint256 maxIndex);

    /**
     * @notice 查找目标索引之前最近的被标记索引
     * @param targetIndex 目标索引
     * @return found 是否找到
     * @return previousIndex 之前最近的索引
     */
    function findPreviousMarkedIndex(
        uint256 targetIndex
    ) external view returns (bool found, uint256 previousIndex);

    /**
     * @notice 查看某个时间戳的累计收益
     * @param timestamp 时间戳
     * @return 该时间戳对应的累计收益（带精度）
     */
    function getAccumulatedRevenueAt(uint256 timestamp) external view returns (uint256);

    /**
     * @notice 查看当前的累计总收益
     * @return 当前累计总收益（带精度）
     */
    function getCurrentAccumulatedRevenue() external view returns (uint256);
}
