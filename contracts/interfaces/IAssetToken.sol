// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IAssetToken
 * @notice 资产代币接口
 */
interface IAssetToken is IERC20 {    
    
    /**
     * @notice 购买资产代币
     * @param amount 购买数量
     * @dev 用户需要先 approve paymentToken 给 collateralVault 合约
     * @dev 支付金额根据公式计算: (amount × fundraiseAmount) / maxTotalSupply
     * @dev 支付代币会直接转入抵押品金库合约
     */
    function purchase(uint256 amount) external;
}
