// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOrderBook
 * @notice 订单簿接口
 */
interface IOrderBook {
    // 订单状态
    enum OrderStatus {
        Active,      // 活跃
        Filled,      // 已完全成交
        Cancelled    // 已取消
    }

    // 订单结构
    struct Order {
        uint256 orderId;           // 订单ID
        address seller;            // 卖方地址
        uint256 amount;            // 卖出数量（AssetToken）
        uint256 price;             // 单价（稳定币，精度18位）
        uint256 filledAmount;      // 已成交数量
        OrderStatus status;        // 订单状态
        uint256 createdAt;         // 创建时间
        uint256 lastDividendTime;  // 卖方在创建订单时的上次分红时间
        uint256 lastLiquidationClaimTime;    // 上次领取清算金时间
    }

    /**
     * @notice 创建卖单
     * @param amount 卖出数量
     * @param price 单价（稳定币，精度18位）
     * @param lastDividendTime 卖方在创建订单时的上次分红时间
     * @param lastLiquidationClaimTime 上次领取清算金时间
     * @return orderId 订单ID
     */
    function createSellOrder(
        uint256 amount,
        uint256 price,
        uint256 lastDividendTime,
        uint256 lastLiquidationClaimTime
    ) external returns (uint256);

    /**
     * @notice 取消订单
     * @param orderId 订单ID
     */
    function cancelOrder(uint256 orderId) external;

    /**
     * @notice 更新订单状态（部分或全部成交）
     * @param orderId 订单ID
     * @param amount 成交数量
     */
    function fillOrder(uint256 orderId, uint256 amount) external;

    /**
     * @notice 获取订单详情
     * @param orderId 订单ID
     * @return order 订单信息
     */
    function getOrder(uint256 orderId) external view returns (Order memory);
}

