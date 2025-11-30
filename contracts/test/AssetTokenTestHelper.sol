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
}

