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
     * @return count 从 holdTime 开始的所有清算次数
     */
    function findLiquidationTimeRange(
        uint256 holdTime
    ) external view returns (uint256 count);
}
