// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 代币，用于测试
 * @dev 可以随意铸造代币
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    /**
     * @notice 构造函数
     * @param name 代币名称
     * @param symbol 代币符号
     * @param decimals_ 小数位数
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    /**
     * @notice 铸造代币
     * @param to 接收者地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice 销毁代币
     * @param from 销毁地址
     * @param amount 销毁数量
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    /**
     * @notice 返回小数位数
     * @return 小数位数
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

