// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAssetToken.sol";
import "./interfaces/ICollateralVault.sol";
import "./interfaces/IRevenueManager.sol";
import "./interfaces/ILiquidateManager.sol";
import "./interfaces/IOrderBook.sol";

/**
 * @title AssetToken
 * @notice RWA资产代币 - 带合规检查的ERC20代币
 * @dev Layer 4: 业务逻辑层
 */
contract AssetToken is IAssetToken, ERC20 {

    // 资产元数据结构体
    struct AssetMetadata {
        string name;
        string symbol;
        uint256 totalValue;             // 资产总价值
        uint256 fundraiseAmount;        // 募集金额
        uint256 maxTotalSupply;         // 代币总发行量上限
        address specialPurposeVehicle;  // 法律实体
        address provider;               // 资产提供方
        uint256 createdAt;              // 创建时间
    }

    // 持有者信息结构体
    struct HolderInfo {
        uint256 shares;                      // 持有份额
        uint256 holdingStartTime;            // 持有开始时间
        uint256 lastDividendTime;            // 上次分红时间
        uint256 lastLiquidationClaimTime;    // 上次领取清算金时间
    }

    // 无效时间戳常量：表示从未领取
    uint256 public constant INVALID_TIMESTAMP = type(uint256).max;

    // 资产元数据
    AssetMetadata public metadata;

    // 支付代币地址（用于购买，例如 USDT）
    address public paymentToken;

    // 抵押品金库合约地址
    address public collateralVault;

    // 收益管理合约地址
    address public revenueManager;

    // 清算管理合约地址
    address public liquidateManager;

    // 订单簿合约地址
    address public orderBook;

    // 持有者列表
    address[] public holders;
    mapping(address => bool) public isHolder;

    // 持有者信息映射
    mapping(address => HolderInfo[]) public holderInfo;

    // 持有者的订单列表（持有者地址 => 订单ID数组）
    mapping(address => uint256[]) public holderOrders;

    // 账户冻结金额
    mapping(address => uint256) public frozenAmounts;

    // 剩余可铸造供应量
    uint256 public remainingMintableSupply;

    constructor() ERC20("Asset Token", "ASSET") {
        // 初始化时不设置任何权限，由initialize函数设置
    }

    /**
     * @notice 初始化资产代币（用于工厂模式）
     * @param _metadata 资产元数据
     * @param _paymentToken 支付代币地址
     */
    function initialize(
        AssetMetadata memory _metadata,
        address _paymentToken,
        address _collateralVault,
        address _revenueManager
    ) external {
        require(metadata.createdAt == 0, "Already initialized");
        
        metadata = _metadata;
        paymentToken = _paymentToken;
        collateralVault = _collateralVault;
        revenueManager = _revenueManager;
        remainingMintableSupply = _metadata.maxTotalSupply;
    }
        
    /**
     * @notice 购买资产代币
     * @param amount 购买数量
     */
    function purchase(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(remainingMintableSupply >= amount, "Insufficient remaining supply");
        
        uint256 paymentAmount = (amount * metadata.fundraiseAmount) / metadata.maxTotalSupply;
        require(paymentAmount > 0, "Payment amount too small");
        
        require(collateralVault != address(0), "Collateral vault not set");
        require(
            IERC20(paymentToken).transferFrom(msg.sender, collateralVault, paymentAmount),
            "Payment transfer failed"
        );
        
        _mint(msg.sender, amount);
        remainingMintableSupply -= amount;
        
        _addHolder(msg.sender);
        holderInfo[msg.sender].push(HolderInfo({
            shares: amount,
            holdingStartTime: block.timestamp,
            lastDividendTime: INVALID_TIMESTAMP,
            lastLiquidationClaimTime: INVALID_TIMESTAMP
        }));
    }

    /**
     * @notice 提取分红和清算金
     * @param recipient 接收者地址
     * @param holder 持有者地址
     */
    function withdrawDividend(
        address recipient,
        address holder
    ) external returns (uint256 dividendAmount) {
        require(recipient != address(0), "Invalid recipient");
        require(holder != address(0), "Invalid holder");
        require(holderInfo[holder].length > 0, "No shares held");
        
        uint256 withdrawTime = block.timestamp;
        dividendAmount = 0;
        uint256 totalLiquidationCount = 0;
        uint256 totalShares = 0;
        
        for (uint256 i = 0; i < holderInfo[holder].length; i++) {
            HolderInfo storage info = holderInfo[holder][i];
            
            uint256 lastDividendTime = info.lastDividendTime;
            uint256 lastClaimTime = info.lastLiquidationClaimTime;
            
            if (lastDividendTime == INVALID_TIMESTAMP) {
                lastDividendTime = info.holdingStartTime;
            }
            if (lastClaimTime == INVALID_TIMESTAMP) {
                lastClaimTime = info.holdingStartTime;
            }
            
            if (withdrawTime > lastDividendTime) {
                uint256 shareDividend = _calculateDividendAmount(lastDividendTime, withdrawTime, info.shares);
                dividendAmount += shareDividend;
            }

            if (withdrawTime > lastClaimTime && liquidateManager != address(0)) {
                (uint256 liquidationCount,,) = ILiquidateManager(liquidateManager).findLiquidationTimeRange(lastClaimTime, withdrawTime);
                if (liquidationCount > 0) {
                    totalLiquidationCount += liquidationCount;
                }
            }

            totalShares += info.shares;
        }
        
        if (dividendAmount > 0 && collateralVault != address(0)) {
            ICollateralVault(collateralVault).transferRevenue(recipient, dividendAmount);
        }

        if (totalLiquidationCount > 0 && collateralVault != address(0)) {
            uint256 totalSupplyAmount = totalSupply();
            ICollateralVault(collateralVault).transferLiquidatableCollateral(
                recipient,
                totalShares,
                totalSupplyAmount,
                totalLiquidationCount
            );
        }
        
        delete holderInfo[holder];
        holderInfo[holder].push(HolderInfo({
            shares: totalShares,
            holdingStartTime: INVALID_TIMESTAMP,
            lastDividendTime: withdrawTime,
            lastLiquidationClaimTime: withdrawTime
        }));
        
        return dividendAmount;
    }

    /**
     * @notice 出售资产份额
     * @param amount 出售数量
     * @param price 单价
     * @param recipient 接收者地址
     */
    function sellShares(
        uint256 amount,
        uint256 price,
        address recipient
    ) external returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(price > 0, "Price must be greater than 0");
        require(orderBook != address(0), "OrderBook not set");

        withdrawDividend(recipient, msg.sender);
        
        HolderInfo storage info = holderInfo[msg.sender][0];
        require(info.shares > 0, "No shares held");
        
        _approve(
            msg.sender, 
            orderBook, 
            allowance(msg.sender, address(this)) + amount
        );
        
        frozenAmounts[msg.sender] += amount;
        
        uint256 lastDividendTime = info.lastDividendTime;
        uint256 lastClaimTime = info.lastLiquidationClaimTime;
        
        uint256 orderId = IOrderBook(orderBook).createSellOrder(
            amount, 
            price, 
            lastDividendTime,
            lastClaimTime
        );
        
        holderOrders[msg.sender].push(orderId);
        
        return orderId;
    }

    /**
     * @notice 取消订单
     * @param orderId 订单ID
     */
    function cancelOrder(uint256 orderId) external {
        require(orderBook != address(0), "OrderBook not set");
        
        IOrderBook orderBook_ = IOrderBook(orderBook);
        IOrderBook.Order memory order = orderBook_.getOrder(orderId);
        
        require(order.seller == msg.sender, "Not order owner");
        require(order.status == IOrderBook.OrderStatus.Active, "Order not active");
        
        uint256 refundAmount = order.amount - order.filledAmount;
        uint256 orderLastDividendTime = order.lastDividendTime;
        uint256 orderLastLiquidationClaimTime = order.lastLiquidationClaimTime;
        
        orderBook_.cancelOrder(orderId);
        
        if (refundAmount > 0) {
            holderInfo[msg.sender].push(
                HolderInfo({
                    shares: refundAmount,
                    holdingStartTime: INVALID_TIMESTAMP,
                    lastDividendTime: orderLastDividendTime,
                    lastLiquidationClaimTime: orderLastLiquidationClaimTime
                })
            );
        }
    }

    /**
     * @notice 支付订单
     * @param orderId 订单ID
     * @param purchaseAmount 购买数量
     */
    function payOrder(uint256 orderId, uint256 purchaseAmount) external {
        require(orderBook != address(0), "OrderBook not set");
        require(purchaseAmount > 0, "Purchase amount must be greater than 0");
        
        IOrderBook orderBook_ = IOrderBook(orderBook);
        IOrderBook.Order memory order = orderBook_.getOrder(orderId);
        
        require(order.status == IOrderBook.OrderStatus.Active, "Order not active");
        uint256 remainingAmount = order.amount - order.filledAmount;
        require(purchaseAmount <= remainingAmount, "Purchase amount exceeds remaining");
        
        address seller = order.seller;
        uint256 orderLastDividendTime = order.lastDividendTime;
        uint256 orderLastLiquidationClaimTime = order.lastLiquidationClaimTime;
        uint256 currentTime = block.timestamp;
        
        uint256 dividendAmount = 0;
        if (currentTime > orderLastDividendTime && orderLastDividendTime != INVALID_TIMESTAMP && revenueManager != address(0)) {
            dividendAmount = _calculateDividendAmount(
                orderLastDividendTime,
                currentTime,
                purchaseAmount
            );
            
            if (dividendAmount > 0 && collateralVault != address(0)) {
                ICollateralVault(collateralVault).transferRevenue(seller, dividendAmount);
            }
        }
        
        if (currentTime > orderLastLiquidationClaimTime && orderLastLiquidationClaimTime != INVALID_TIMESTAMP && liquidateManager != address(0)) {
            (uint256 liquidationCount,,) = ILiquidateManager(liquidateManager).findLiquidationTimeRange(
                orderLastLiquidationClaimTime,
                currentTime
            );
            
            if (liquidationCount > 0 && collateralVault != address(0)) {
                uint256 totalSupplyAmount = totalSupply();
                ICollateralVault(collateralVault).transferLiquidatableCollateral(
                    seller,
                    purchaseAmount,
                    totalSupplyAmount,
                    liquidationCount
                );
            }
        }
        
        uint256 paymentAmount = (purchaseAmount * order.price) / 1e18;
        require(paymentAmount > 0, "Payment amount is zero");
        require(paymentToken != address(0), "Payment token not set");
        require(
            IERC20(paymentToken).transferFrom(msg.sender, seller, paymentAmount),
            "Payment transfer failed"
        );
        
        _transfer(seller, msg.sender, purchaseAmount);
        
        _addHolder(msg.sender);
        holderInfo[msg.sender].push(
            HolderInfo({
                shares: purchaseAmount,
                holdingStartTime: currentTime,
                lastDividendTime: INVALID_TIMESTAMP,
                lastLiquidationClaimTime: INVALID_TIMESTAMP
            })
        );
        
        orderBook_.fillOrder(orderId, purchaseAmount);
    }

    /**
     * @notice 计算分红金额
     */
    function _calculateDividendAmount(
        uint256 lastDividendTime,
        uint256 withdrawTime,
        uint256 holderShares
    ) private view returns (uint256 dividendAmount) {
        if (revenueManager == address(0)) return 0;
        if (withdrawTime <= lastDividendTime) return 0;
        
        (bool foundMin, uint256 minIndex) = IRevenueManager(revenueManager).findMinMarkedIndex(
            lastDividendTime,
            withdrawTime
        );
        
        (bool foundMax, uint256 maxIndex) = IRevenueManager(revenueManager).findMaxMarkedIndex(
            lastDividendTime,
            withdrawTime
        );
        
        if (!foundMin || !foundMax) return 0;
        if (minIndex > maxIndex) return 0;
        
        uint256 revenueAtMinIndex = IRevenueManager(revenueManager).getAccumulatedRevenueAt(minIndex);
        uint256 revenueAtMaxIndex = IRevenueManager(revenueManager).getAccumulatedRevenueAt(maxIndex);
        
        if (revenueAtMaxIndex < revenueAtMinIndex) return 0;
        uint256 periodRevenue = revenueAtMaxIndex - revenueAtMinIndex;
        
        uint256 totalSupplyAmount = totalSupply();
        if (totalSupplyAmount == 0) return 0;
        
        dividendAmount = (holderShares * periodRevenue) / totalSupplyAmount;
        
        return dividendAmount;
    }

    function _addHolder(address holder) private {
        if (!isHolder[holder] && holder != address(0)) {
            holders.push(holder);
            isHolder[holder] = true;
        }
    }

    function _removeHolder(address holder) private {
        if (isHolder[holder]) {
            isHolder[holder] = false;
        }
    }

    function setPaymentToken(address _paymentToken) external {
        require(_paymentToken != address(0), "Invalid payment token");
        paymentToken = _paymentToken;
    }

    function setCollateralVault(address _collateralVault) external {
        require(_collateralVault != address(0), "Invalid collateral vault");
        collateralVault = _collateralVault;
    }

    function setLiquidateManager(address _liquidateManager) external {
        require(_liquidateManager != address(0), "Invalid liquidate manager");
        liquidateManager = _liquidateManager;
    }

    function setOrderBook(address _orderBook) external {
        require(_orderBook != address(0), "Invalid order book");
        orderBook = _orderBook;
    }

    function getHolderOrders(address holder) external view returns (uint256[] memory) {
        return holderOrders[holder];
    }
}

