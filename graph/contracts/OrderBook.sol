// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";


/**
 * @title OrderBook
 * @notice 资产代币链上限价订单簿
 * @dev MVP版本 - 支持限价卖单的创建、成交和取消
 */
contract OrderBook {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

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
    }

    // 状态变量
    IERC20 public immutable paymentToken;               // 支付代币（稳定币）
    uint256 public nextOrderId;                         // 下一个订单ID
    mapping(uint256 => Order) public orders;            // 订单映射
    mapping(address => uint256[]) public userOrders;    // 用户订单列表

    // 手续费设置（基点，10000 = 100%）
    uint256 public feeRate;                         // 手续费率（例如 30 = 0.3%）
    address public feeCollector;                    // 手续费收集地址

    // 事件
    event OrderCreated(
        uint256 indexed orderId,
        address indexed seller,
        uint256 amount,
        uint256 price
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 filledAmount,
        uint256 remainingAmount,
        uint256 totalPayment
    );

    event OrderCancelled(
        uint256 indexed orderId,
        uint256 refundedAmount
    );


    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeCollectorUpdated(address oldCollector, address newCollector);

    /**
     * @notice 构造函数
     * @param _paymentToken 支付代币地址（稳定币）
     * @param _feeCollector 手续费收集地址
     * @param _feeRate 手续费率（基点）
     */
    constructor(
        address _paymentToken,
        address _feeCollector,
        uint256 _feeRate
    ) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_feeCollector != address(0), "Invalid fee collector");
        require(_feeRate <= 1000, "Fee rate too high"); // 最大10%

        paymentToken = IERC20(_paymentToken);
        
        feeCollector = _feeCollector;
        feeRate = _feeRate;
        nextOrderId = 1;

    }

    /**
     * @notice 创建卖单
     * @param amount 卖出数量
     * @param price 单价（稳定币，精度18位）
     * @return orderId 订单ID
     */
    function createSellOrder(
        uint256 amount,
        uint256 price
    ) external returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(price > 0, "Price must be greater than 0");

        // 创建订单
        uint256 orderId = nextOrderId++;
        orders[orderId] = Order({
            orderId: orderId,
            seller: msg.sender,
            amount: amount,
            price: price,
            filledAmount: 0,
            status: OrderStatus.Active,
            createdAt: block.timestamp
        });

        userOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, msg.sender, amount, price);

        return orderId;
    }

    /**
     * @notice 购买订单（部分或全部成交）
     * @param orderId 订单ID
     * @param amount 购买数量
     */
    function fillOrder(
        uint256 orderId,
        uint256 amount
    ) external {
        Order storage order = orders[orderId];
        
        require(order.status == OrderStatus.Active, "Order not active");
        require(amount > 0, "Amount must be greater than 0");

        // 计算可成交数量
        uint256 remainingAmount = order.amount - order.filledAmount;
        require(remainingAmount > 0, "Order fully filled");
        
        uint256 fillAmount = amount > remainingAmount ? remainingAmount : amount;

        // 计算支付金额
        uint256 sellerPayment = (fillAmount * order.price) / 1e18;
        uint256 fee = (sellerPayment * feeRate) / 10000;
        uint256 totalPayment = sellerPayment + fee;

        // 收取买方稳定币
        paymentToken.safeTransferFrom(msg.sender, order.seller, sellerPayment);
        if (fee > 0) {
            paymentToken.safeTransferFrom(msg.sender, feeCollector, fee);
        }

        // 更新订单状态
        order.filledAmount += fillAmount;
        remainingAmount -= fillAmount;

        if (remainingAmount == 0) {
            order.status = OrderStatus.Filled;
        }

        emit OrderFilled(orderId, msg.sender, fillAmount, remainingAmount, totalPayment);
    }

    /**
     * @notice 取消订单
     * @param orderId 订单ID
     */
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        
        require(order.seller == msg.sender, "Not order owner");
        require(order.status == OrderStatus.Active, "Order not active");

        uint256 refundAmount = order.amount - order.filledAmount;
        require(refundAmount > 0, "Nothing to refund");

        // 更新状态
        order.status = OrderStatus.Cancelled;

        emit OrderCancelled(orderId, refundAmount);
    }


    /**
     * @notice 获取订单详情
     * @param orderId 订单ID
     * @return order 订单信息
     */
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    /**
     * @notice 获取用户的所有订单ID
     * @param user 用户地址
     * @return 订单ID数组
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /**
     * @notice 获取订单剩余数量
     * @param orderId 订单ID
     * @return 剩余数量
     */
    function getOrderRemainingAmount(uint256 orderId) external view returns (uint256) {
        Order memory order = orders[orderId];
        if (order.status != OrderStatus.Active) {
            return 0;
        }
        return order.amount - order.filledAmount;
    }

    /**
     * @notice 更新手续费率
     * @param newFeeRate 新手续费率（基点）
     */
    function setFeeRate(uint256 newFeeRate) external  {
        require(newFeeRate <= 1000, "Fee rate too high"); // 最大10%
        uint256 oldRate = feeRate;
        feeRate = newFeeRate;
        emit FeeRateUpdated(oldRate, newFeeRate);
    }

    /**
     * @notice 更新手续费收集地址
     * @param newFeeCollector 新收集地址
     */
    function setFeeCollector(address newFeeCollector) external  {
        require(newFeeCollector != address(0), "Invalid fee collector");
        address oldCollector = feeCollector;
        feeCollector = newFeeCollector;
        emit FeeCollectorUpdated(oldCollector, newFeeCollector);
    }

}

