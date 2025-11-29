// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICollateralVault
 * @notice 抵押金库接口
 */
interface ICollateralVault {
    /**
     * @notice 记录募集资金（由 AssetToken 合约调用）
     * @param buyer 购买者地址
     * @param amount 募集金额
     */
    function recordFundraise(
        address buyer,
        uint256 amount
    ) external;

    /**
     * @notice 提取募集资金
     * @param recipient 接收者地址
     * @param amount 提取金额
     */
    function withdrawFundraise(
        address recipient,
        uint256 amount
    ) external;

    /**
     * @notice 获取可提取募集资金
     * @return available 可提取金额
     */
    function getAvailableFundraise() external view returns (uint256);

    /**
     * @notice 更新当前收益额
     * @param revenueIncrement 收益增额
     */
    function updateCurrentRevenue(uint256 revenueIncrement) external;

    /**
     * @notice 转出收益到指定地址
     * @param recipient 接收者地址
     * @param amount 转出金额
     */
    function transferRevenue(
        address recipient,
        uint256 amount
    ) external;

    /**
     * @notice 更新可清算押金金额
     * @param increasePercentage 增加的百分比（基点）
     */
    function updateLiquidatableCollateral(uint256 increasePercentage) external;

    /**
     * @notice 转移清算金额到指定地址
     * @param recipient 接收者地址
     * @param shareBase 分数基数（持有份额）
     * @param totalShares 总份额
     * @param liquidationCount 清算次数
     * @return amount 实际转账金额
     */
    function transferLiquidatableCollateral(
        address recipient,
        uint256 shareBase,
        uint256 totalShares,
        uint256 liquidationCount
    ) external returns (uint256 amount);

    /**
     * @notice 获取可清算押金金额
     * @return amount 可清算押金金额
     */
    function liquidatableCollateralAmount() external view returns (uint256);

}
