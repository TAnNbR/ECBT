// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";    
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CollateralVault
 * @notice 抵押金库 - 管理资产提供者的抵押金
 * @dev Layer 3: 金融层
 */
contract CollateralVault is AccessControl, ReentrancyGuard {
    // 稳定币地址
    IERC20 public immutable collateralToken;

    // 总募集资金金额（所有资产的总和）
    uint256 public totalFundraisedAmount;

    // 已提取募集资金金额
    uint256 public totalWithdrawnFundraise;

    // 当前收益额
    uint256 public currentRevenue;

    // 已分配收益额
    uint256 public distributedRevenue;

    // 已存入收益额
    uint256 public depositedRevenue;

    // 总押金金额
    uint256 public totalCollateralAmount;

    // 可清算押金金额
    uint256 public liquidatableCollateralAmount;

    /**
     * @notice 记录募集资金（由 AssetToken 合约调用）
     * @param buyer 购买者地址
     * @param amount 募集金额
     */
    function recordFundraise(
        address buyer,
        uint256 amount
    ) external onlyRole(ASSET_TOKEN_ROLE) {
        require(buyer != address(0), "Invalid buyer");
        require(amount > 0, "Amount must be positive");

        totalFundraisedAmount += amount;

        emit FundraiseReceived(buyer, amount, totalFundraisedAmount);
    }

    /**
     * @notice 提取募集资金
     * @param recipient 接收者地址
     * @param amount 提取金额
     */
    function withdrawFundraise(
        address recipient,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");

        uint256 available = totalFundraisedAmount - totalWithdrawnFundraise;
        require(available >= amount, "Insufficient fundraised amount");

        totalWithdrawnFundraise += amount;

        collateralToken.safeTransfer(recipient, amount);

        emit FundraiseWithdrawn(recipient, amount, available - amount);
    }

    /**
     * @notice 资产提供者存入押金
     * @param amount 存入押金金额
     */
    function depositCollateralByProvider(uint256 amount) external onlyRole(ASSET_PROVIDER_ROLE) nonReentrant {
        require(amount > 0, "Amount must be positive");

        totalCollateralAmount += amount;

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDepositedByProvider(msg.sender, amount);
    }

    /**
     * @notice 更新当前收益额
     * @param revenueIncrement 收益增额
     */
    function updateCurrentRevenue(uint256 revenueIncrement) external onlyRole(ADMIN_ROLE) {
        uint256 previousRevenue = currentRevenue;
        currentRevenue += revenueIncrement;
        emit CurrentRevenueUpdated(currentRevenue, previousRevenue);
    }

    /**
     * @notice 资产提供者存入收益
     * @param amount 存入收益金额
     */
    function depositRevenue(uint256 amount) external onlyRole(ASSET_PROVIDER_ROLE) nonReentrant {
        require(amount > 0, "Amount must be positive");

        depositedRevenue += amount;

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit RevenueDeposited(msg.sender, amount, depositedRevenue);
    }

    /**
     * @notice 转出收益到指定地址
     * @param recipient 接收者地址
     * @param amount 转出金额
     */
    function transferRevenue(
        address recipient,
        uint256 amount
    ) external nonReentrant {
        // 只允许管理员或 AssetToken 合约调用
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(ASSET_TOKEN_ROLE, msg.sender),
            "Caller is not admin or asset token"
        );
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");

        // 计算可用收益：已存入的收益 - 已分配的收益
        uint256 availableRevenue = depositedRevenue - distributedRevenue;
        require(availableRevenue >= amount, "Insufficient available revenue");

        // 更新已分配收益
        distributedRevenue += amount;

        // 转账
        collateralToken.safeTransfer(recipient, amount);

        emit RevenueTransferred(recipient, amount, availableRevenue - amount);
    }

    /**
     * @notice 获取可用收益金额
     * @return available 可用收益金额
     */
    function getAvailableRevenue() external view returns (uint256) {
        return depositedRevenue - distributedRevenue;
    }

    /**
     * @notice 更新可清算押金金额
     * @param increasePercentage 增加的百分比（基点，例如 2000 = 20%）
     * @dev 只允许 LiquidateEngine 或管理员调用
     */
    function updateLiquidatableCollateral(uint256 increasePercentage) external onlyRole(ADMIN_ROLE) {
        require(increasePercentage > 0 && increasePercentage <= 10000, "Invalid percentage");
        
        // 计算增加的金额 = 总押金 * 百分比 / 10000
        uint256 increaseAmount = (totalCollateralAmount * increasePercentage) / 10000;
        
        // 增加可清算押金金额
        liquidatableCollateralAmount += increaseAmount;
        
        emit LiquidatableCollateralUpdated(liquidatableCollateralAmount, increaseAmount);
    }

    /**
     * @notice 转移清算金额到指定地址
     * @param recipient 接收者地址
     * @param shareBase 分数基数（持有份额）
     * @param totalShares 总份额
     * @param liquidationCount 清算次数
     * @return amount 实际转账金额
     * @dev 只允许管理员或 AssetToken 合约调用
     * @dev 计算逻辑：
     *      1. 单次清算金额 = totalCollateralAmount × (LIQUIDATION_PERCENTAGE / 10000)
     *      2. 持有者应得 = (shareBase / totalShares) × 单次清算金额 × liquidationCount
     */
    function transferLiquidatableCollateral(
        address recipient,
        uint256 shareBase,
        uint256 totalShares,
        uint256 liquidationCount
    ) external nonReentrant returns (uint256 amount) {
        // 只允许管理员或 AssetToken 合约调用
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(ASSET_TOKEN_ROLE, msg.sender),
            "Caller is not admin or asset token"
        );
        require(recipient != address(0), "Invalid recipient");
        require(shareBase > 0, "Share base must be positive");
        require(totalShares > 0, "Total shares must be positive");
        require(liquidationCount > 0, "Liquidation count must be positive");
        require(shareBase <= totalShares, "Share base exceeds total shares");

        // 计算转账金额：
        // 1. 单次清算金额 = 总押金 * 百分比 / 10000
        uint256 singleLiquidationAmount = (totalCollateralAmount * LIQUIDATION_PERCENTAGE) / 10000;
        
        // 2. 持有者应得金额 = (持有份额 / 总份额) * 单次清算金额 * 清算次数
        amount = (shareBase * singleLiquidationAmount * liquidationCount) / totalShares;
        
        require(amount > 0, "Calculated amount is zero");
        require(liquidatableCollateralAmount >= amount, "Insufficient liquidatable collateral");

        // 扣除可清算金额
        liquidatableCollateralAmount -= amount;

        // 转账
        collateralToken.safeTransfer(recipient, amount);

        emit LiquidatableCollateralTransferred(recipient, amount, liquidatableCollateralAmount);
        
        return amount;
    }

    /**
     * @notice 授予 AssetToken 角色
     * @param assetToken AssetToken 合约地址
     */
    function grantAssetTokenRole(address assetToken) external onlyRole(ADMIN_ROLE) {
        require(assetToken != address(0), "Invalid asset token");
        _grantRole(ASSET_TOKEN_ROLE, assetToken);
    }

    /**
     * @notice 撤销 AssetToken 角色
     * @param assetToken AssetToken 合约地址
     */
    function revokeAssetTokenRole(address assetToken) external onlyRole(ADMIN_ROLE) {
        _revokeRole(ASSET_TOKEN_ROLE, assetToken);
    }

    /**
     * @notice 授予 LiquidateEngine 管理员角色
     * @param liquidateEngine LiquidateEngine 合约地址
     */
    function grantLiquidateEngineRole(address liquidateEngine) external onlyRole(ADMIN_ROLE) {
        require(liquidateEngine != address(0), "Invalid liquidate engine");
        _grantRole(ADMIN_ROLE, liquidateEngine);
    }

    /**
     * @notice 撤销 LiquidateEngine 管理员角色
     * @param liquidateEngine LiquidateEngine 合约地址
     */
    function revokeLiquidateEngineRole(address liquidateEngine) external onlyRole(ADMIN_ROLE) {
        _revokeRole(ADMIN_ROLE, liquidateEngine);
    }


}

