// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILiquidateManager
 * @notice 清算管理器接口
 */
interface ILiquidateManager {
    /**
     * @notice 查找持有期间内的清算次数
     * @param holdTime 持有时间（开始时间）
     * @param claimTime 取回清算份额的时间（结束时间）
     * @return liquidationCount 持有期间内包含的清算时间戳数量（索引之差 + 1）
     * @return foundFirst 是否找到第一个清算时间
     * @return foundLast 是否找到最后一个清算时间
     */
    function findLiquidationTimeRange(
        uint256 holdTime,
        uint256 claimTime
    ) external view returns (
        uint256 liquidationCount,
        bool foundFirst,
        bool foundLast
    );
}
