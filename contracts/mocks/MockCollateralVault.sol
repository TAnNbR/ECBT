// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockCollateralVault
 * @notice 用于测试的 CollateralVault 模拟合约
 */
contract MockCollateralVault {
    bool public updateCalled;
    uint256 public lastUpdatePercentage;
    uint256 public callCount;

    mapping(address => mapping(address => uint256)) public availableCollateral;

    function updateLiquidatableCollateral(uint256 increasePercentage) external {
        updateCalled = true;
        lastUpdatePercentage = increasePercentage;
        callCount++;
    }

    function getAvailableCollateral(
        address provider,
        address asset
    ) external view returns (uint256) {
        return availableCollateral[provider][asset];
    }

    function setAvailableCollateral(
        address provider,
        address asset,
        uint256 amount
    ) external {
        availableCollateral[provider][asset] = amount;
    }

    function wasUpdateCalled() external view returns (bool) {
        return updateCalled;
    }

    function getLastUpdatePercentage() external view returns (uint256) {
        return lastUpdatePercentage;
    }

    function resetMock() external {
        updateCalled = false;
        lastUpdatePercentage = 0;
        callCount = 0;
    }
}

