// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../AssetToken.sol";

/**
 * @title AssetTokenTestHelper
 * @notice 测试辅助合约，用于暴露 AssetToken 的 private 函数
 */
contract AssetTokenTestHelper is AssetToken {
    /**
     * @notice 暴露 _calculateDividendAmount 函数用于测试
     */
    function calculateDividendAmountPublic(
        uint256 lastDividendTime,
        uint256 withdrawTime,
        uint256 holderShares
    ) external view returns (uint256) {
        return _calculateDividendAmount(lastDividendTime, withdrawTime, holderShares);
    }

    /**
     * @notice 设置 revenueManager 用于测试
     */
    function setRevenueManager(address _revenueManager) external {
        revenueManager = _revenueManager;
    }

    /**
     * @notice 添加持有者信息用于测试
     * @param holder 持有者地址
     * @param shares 持有份额数量
     * @param holdingStartTime 持有开始时间
     * @param lastDividendTime 上次领取分红的时间
     * @param lastLiquidationClaimTime 上次领取清算金的时间
     */
    function addHolderInfo(
        address holder,
        uint256 shares,
        uint256 holdingStartTime,
        uint256 lastDividendTime,
        uint256 lastLiquidationClaimTime
    ) external {
        holderInfo[holder].push(HolderInfo({
            shares: shares,
            holdingStartTime: holdingStartTime,
            lastDividendTime: lastDividendTime,
            lastLiquidationClaimTime: lastLiquidationClaimTime
        }));
        
        // 如果还不是持有者，添加到持有者列表
        if (!isHolder[holder]) {
            isHolder[holder] = true;
            holders.push(holder);
        }
    }
}

