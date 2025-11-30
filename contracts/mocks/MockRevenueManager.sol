// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockRevenueManager
 * @notice 用于测试的 RevenueManager 模拟合约
 */
contract MockRevenueManager {
    uint256 public lastestAccumulatedRevenue;
    uint256 public callCount;

    function setLastestAccumulatedRevenue(uint256 _revenue) external {
        lastestAccumulatedRevenue = _revenue;
        callCount++;
    }

    function getCallCount() external view returns (uint256) {
        return callCount;
    }

    function resetCallCount() external {
        callCount = 0;
    }
}

