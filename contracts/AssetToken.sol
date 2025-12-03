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

    /**
     * @dev 资产元数据结构体
     * @dev 存储资产的基本信息和募资参数
     */
    struct AssetMetadata {
        string name;                        // 资产名称
        string symbol;                      // 资产代号
        uint256 totalValue;                 // 资产总价值（USDT计价）
        uint256 fundraiseAmount;            // 募集金额目标
        uint256 maxTotalSupply;             // 代币总发行量上限
        address specialPurposeVehicle;      // 法律实体（SPV）地址
        address provider;                   // 资产提供方地址
        uint256 createdAt;                  // 资产创建时间戳
    }

    /**
     * @dev 持有者信息结构体
     * @dev 用于追踪每个持有者的份额和收益领取情况
     * @dev 一个持有者可能有多个 HolderInfo 记录（不同时间购买）
     */
    struct HolderInfo {
        uint256 shares;                      // 持有份额数量
        uint256 holdingStartTime;            // 持有开始时间（首次获得时）
        uint256 lastDividendTime;            // 上次领取分红的时间
        uint256 lastLiquidationClaimTime;    // 上次领取清算金的时间
    }

    // ============ 常量 ============
    
    // 无效时间戳常量：表示从未领取分红/清算金，使用最大的 uint256 值作为标记
    uint256 public constant INVALID_TIMESTAMP = type(uint256).max;

    // ============ 状态变量 ============
    
    // 资产元数据（名称、总价值、募资目标等）
    AssetMetadata public metadata;

    // 支付代币地址（用于购买资产代币，通常是 USDT）
    address public paymentToken;

    // 抵押品金库合约地址（存储募集资金和收益）
    address public collateralVault;

    // 收益管理合约地址（记录和计算分红）
    address public revenueManager;

    // 清算管理合约地址（处理资产未达标时的清算）
    address public liquidateManager;

    // 订单簿合约地址（处理二级市场交易）
    address public orderBook;

    // 持有者地址列表（所有曾经持有过代币的地址）
    address[] public holders;
    
    // 持有者状态映射（地址 => 是否为持有者）
    mapping(address => bool) public isHolder;

    // 持有者信息映射（地址 => HolderInfo数组），一个地址可能有多个份额记录，代表不同时间的购买
    mapping(address => HolderInfo[]) public holderInfo;

    // 持有者的订单列表（持有者地址 => 订单ID数组），记录该持有者在 OrderBook 上创建的所有卖单
    mapping(address => uint256[]) public holderOrders;

    // 账户冻结金额（地址 => 冻结数量），当份额挂单出售时会被冻结，避免二次出售
    mapping(address => uint256) public frozenAmounts;

    // 剩余可铸造供应量，初始值为 maxTotalSupply，每次 purchase 后递减
    uint256 public remainingMintableSupply;

    /// @notice 供应量耗尽（售罄）时间戳
    /// @dev 未截断的完整时间戳，0表示尚未售罄
    uint256 public soldOutTimestamp;

    // ============ 修饰符 ============

    /**
     * @notice 检查代币是否已售罄
     * @dev 要求 soldOutTimestamp 为 0，即代币供应量未完全耗尽
     */
    modifier onlyNotSoldOut() {
        require(soldOutTimestamp == 0, "Token sold out yet");
        _;
    }

    /**
     * @notice 检查代币是否已售罄
     * @dev 要求 soldOutTimestamp 不为 0，即代币供应量已完全耗尽
     */
    modifier onlySoldOut() {
        require(soldOutTimestamp != 0 && block.timestamp > (soldOutTimestamp + 1 days), "Token not sold out yet");
        _;
    }

    /**
     * @notice 构造函数
     * @dev 使用工厂模式，实际参数由 initialize 函数设置
     * @dev 这样可以使用相同的合约代码创建多个不同的资产代币
     */
    constructor() ERC20("Asset Token", "ASSET") {
        // 初始化时不设置任何权限，由initialize函数设置
    }

    /**
     * @notice 初始化资产代币（用于工厂模式）
     * @param _metadata 资产元数据
     * @param _paymentToken 支付代币地址（如 USDT）
     * @param _collateralVault 抵押品金库地址
     * @param _revenueManager 收益管理合约地址
     * @dev 该函数只能调用一次，用于设置合约的基本参数
     */
    function initialize(
        AssetMetadata memory _metadata,
        address _paymentToken,
        address _collateralVault,
        address _revenueManager
    ) external {
        // 通过检查 createdAt 确保只能初始化一次
        require(metadata.createdAt == 0, "Already initialized");
        
        // 保存资产元数据
        metadata = _metadata;
        
        // 设置关键合约地址
        paymentToken = _paymentToken;
        collateralVault = _collateralVault;
        revenueManager = _revenueManager;
        
        // 初始化可铸造供应量为最大供应量
        remainingMintableSupply = _metadata.maxTotalSupply;
    }
        
    /**
     * @notice 购买资产代币
     * @param amount 购买数量
     * @dev 用户需要先 approve paymentToken 给 collateralVault
     * @dev 支付金额计算公式: (amount × fundraiseAmount) / maxTotalSupply
     * @dev 执行流程:
     *      1. 验证购买数量和剩余供应量
     *      2. 计算并转移支付代币到抵押品金库
     *      3. 铸造资产代币给购买者
     *      4. 创建持有者信息记录
     */
    function purchase(uint256 amount) external onlyNotSoldOut() {
        // 1. 验证购买数量
        require(amount > 0, "Amount must be greater than 0");
        require(remainingMintableSupply >= amount, "Insufficient remaining supply");
        
        // 2. 计算需要支付的金额
        // 公式: 购买数量 × 募集总额 ÷ 代币总量
        uint256 paymentAmount = (amount * metadata.fundraiseAmount) / metadata.maxTotalSupply;
        require(paymentAmount > 0, "Payment amount too small");
        
        // 3. 转移支付代币（USDT等）到抵押品金库
        require(collateralVault != address(0), "Collateral vault not set");
        require(
            IERC20(paymentToken).transferFrom(msg.sender, collateralVault, paymentAmount),
            "Payment transfer failed"
        );
        
        // 4. 铸造资产代币给购买者
        _mint(msg.sender, amount);
        
        // 5. 更新剩余可铸造数量
        remainingMintableSupply -= amount;
        
        // 6. 将购买者添加到持有者列表
        _addHolder(msg.sender);
        
        // 7. 创建持有者信息记录
        // 初始时分红和清算时间都设为 INVALID_TIMESTAMP，表示从未领取
        holderInfo[msg.sender].push(HolderInfo({
            shares: amount,
            holdingStartTime: IRevenueManager(revenueManager).truncateTimestampBySeconds(block.timestamp),
            lastDividendTime: INVALID_TIMESTAMP,
            lastLiquidationClaimTime: INVALID_TIMESTAMP
        }));

        // 8. 如果供应量耗尽，记录售罄时间戳
        if (remainingMintableSupply == 0 && soldOutTimestamp == 0) {
            soldOutTimestamp = block.timestamp + 1 days;
        }
    }

    /**
     * @notice 提取分红和清算金
     * @param recipient 接收者地址（可以是其他地址）
     * @param holder 持有者地址（代币持有者）
     * @return dividendAmount 提取的分红金额
     * @dev 执行流程:
     *      1. 遍历持有者的所有份额，计算每份额的分红和清算金
     *      2. 转移分红和清算金到接收者
     *      3. 合并所有份额为单一记录，更新分红和清算时间
     */
    function withdrawDividend(
        address recipient,
        address holder
    ) public onlySoldOut() returns (uint256) {
        // 验证地址有效性
        require(recipient != address(0), "Invalid recipient");
        require(holder != address(0), "Invalid holder");
        require(holderInfo[holder].length > 0, "No shares held");
        
        // 当前时间作为提取时间
        uint256 withdrawTime = block.timestamp;
        
        // 初始化累计变量
        uint256 dividendAmount = 0;         // 总分红金额
        uint256 totalLiquidationCount = 0;  // 总清算次数
        uint256 totalShares = 0;            // 总份额
        
        // 遍历持有者的所有份额信息（可能有多个不同时间购买的份额）
        for (uint256 i = 0; i < holderInfo[holder].length; i++) {
            HolderInfo storage info = holderInfo[holder][i];
            
            // 获取该份额的上次分红时间和清算时间
            uint256 lastDividendTime = info.lastDividendTime;
            uint256 lastClaimTime = info.lastLiquidationClaimTime;
            
            // 如果从未分红过，使用持有开始时间作为起点
            if (lastDividendTime == INVALID_TIMESTAMP) {
                lastDividendTime = info.holdingStartTime;
            }
            // 如果从未领取过清算金，使用持有开始时间作为起点
            if (lastClaimTime == INVALID_TIMESTAMP) {
                lastClaimTime = info.holdingStartTime;
            }
            
            // 计算该份额的分红金额
            if (withdrawTime > lastDividendTime) {
                uint256 shareDividend = _calculateDividendAmount(lastDividendTime, withdrawTime, info.shares);
                dividendAmount += shareDividend;
            }

            // 计算该份额期间的清算次数
            if (withdrawTime > lastClaimTime && liquidateManager != address(0)) {
                uint256 liquidationCount = ILiquidateManager(liquidateManager).findLiquidationTimeRange(lastClaimTime, withdrawTime);
                if (liquidationCount > 0) {
                    totalLiquidationCount += liquidationCount;
                }
            }

            // 累加总份额
            totalShares += info.shares;
        }
        
        // 转移分红到接收者
        if (dividendAmount > 0 && collateralVault != address(0)) {
            ICollateralVault(collateralVault).transferRevenue(recipient, dividendAmount);
        }

        // 转移清算金到接收者
        if (totalLiquidationCount > 0 && collateralVault != address(0)) {
            uint256 totalSupplyAmount = totalSupply();
            ICollateralVault(collateralVault).transferLiquidatableCollateral(
                recipient,
                totalShares,
                totalSupplyAmount,
                totalLiquidationCount
            );
        }
        
        // 合并所有份额：删除旧记录，创建单一的新记录
        // 更新时间戳为当前提取时间，作为下次计算的起点
        delete holderInfo[holder];
        holderInfo[holder].push(HolderInfo({
            shares: totalShares,
            holdingStartTime: INVALID_TIMESTAMP,   // 不再需要持有开始时间
            lastDividendTime: withdrawTime,        // 更新为当前时间
            lastLiquidationClaimTime: withdrawTime // 更新为当前时间
        }));
        
        return dividendAmount;
    }

    /**
     * @notice 出售资产份额（创建卖单）
     * @param amount 出售数量
     * @param price 单价（稳定币，精度18位）
     * @param recipient 分红接收者地址
     * @return orderId 创建的订单ID
     * @dev 执行流程:
     *      1. 先提取所有分红和清算金，合并所有份额
     *      2. 授权 OrderBook 可以转移代币
     *      3. 冻结相应数量的份额
     *      4. 在 OrderBook 创建卖单
     */
    function sellShares(
        uint256 amount,
        uint256 price,
        address recipient
    ) external returns (uint256) {
        // 1. 验证参数
        require(amount > 0, "Amount must be greater than 0");
        require(price > 0, "Price must be greater than 0");
        require(orderBook != address(0), "OrderBook not set");

        // 2. 先提取所有可领取的分红和清算金，并合并所有份额
        // 这样确保卖家不会错过任何收益
        withdrawDividend(recipient, msg.sender);
        
        // 3. 提取后只剩一个份额记录，检查是否足够
        HolderInfo storage info = holderInfo[msg.sender][0];
        require(info.shares >= amount, "Insufficient shares");
        
        // 4. 授权 OrderBook 合约可以转移相应数量的代币
        // 使用累加方式，避免覆盖之前的授权额度
        _approve(
            msg.sender, 
            address(this), 
            allowance(msg.sender, address(this)) + amount
        );
        
        // 5. 冻结相应份额，防止重复出售
        frozenAmounts[msg.sender] += amount;
        
        // 6. 获取卖方当前的分红和清算时间，传给订单簿
        uint256 lastDividendTime = info.lastDividendTime;
        uint256 lastClaimTime = info.lastLiquidationClaimTime;
        
        // 7. 在 OrderBook 创建卖单
        uint256 orderId = IOrderBook(orderBook).createSellOrder(
            amount, 
            price, 
            lastDividendTime,
            lastClaimTime
        );
        
        // 8. 记录订单到持有者的订单列表
        holderOrders[msg.sender].push(orderId);
        
        return orderId;
    }

    /**
     * @notice 取消订单
     * @param orderId 订单ID
     * @dev 执行流程:
     *      1. 验证订单所有权和状态
     *      2. 取消订单
     *      3. 恢复持有者信息，保留订单创建时的分红和清算时间
     */
    function cancelOrder(uint256 orderId) external {
        require(orderBook != address(0), "OrderBook not set");
        
        // 1. 从 OrderBook 获取订单信息
        IOrderBook orderBook_ = IOrderBook(orderBook);
        IOrderBook.Order memory order = orderBook_.getOrder(orderId);
        
        // 2. 验证订单所有权
        require(order.seller == msg.sender, "Not order owner");
        require(order.status == IOrderBook.OrderStatus.Active, "Order not active");
        
        // 3. 计算需要退还的数量
        uint256 refundAmount = order.amount - order.filledAmount;
        
        // 4. 保存订单创建时的时间戳
        // 这些时间戳很重要，用于计算期间的分红和清算金
        uint256 orderLastDividendTime = order.lastDividendTime;
        uint256 orderLastLiquidationClaimTime = order.lastLiquidationClaimTime;
        
        // 5. 调用 OrderBook 取消订单
        orderBook_.cancelOrder(orderId);
        
        // 6. 恢复持有者信息，添加取消订单的份额
        // 保留订单创建时的分红和清算时间，以便正确计算期间收益
        if (refundAmount > 0) {
            holderInfo[msg.sender].push(
                HolderInfo({
                    shares: refundAmount,
                    holdingStartTime: INVALID_TIMESTAMP,  // 不需要持有开始时间
                    lastDividendTime: orderLastDividendTime,  // 使用订单创建时的时间
                    lastLiquidationClaimTime: orderLastLiquidationClaimTime  // 使用订单创建时的时间
                })
            );
        }
    }

    /**
     * @notice 支付订单（买家购买卖单）
     * @param orderId 订单ID
     * @param purchaseAmount 购买数量
     * @dev 买家需要先 approve paymentToken 给卖家
     * @dev 执行流程:
     *      1. 验证订单状态和购买数量
     *      2. 计算并转移分红给卖家（订单创建到现在期间的收益）
     *      3. 计算并转移清算金给卖家
     *      4. 买家支付代币给卖家
     *      5. 转移 AssetToken 从卖家到买家
     *      6. 创建买家的持有信息
     *      7. 更新订单状态
     */
    function payOrder(uint256 orderId, uint256 purchaseAmount) external {
        require(orderBook != address(0), "OrderBook not set");
        require(purchaseAmount > 0, "Purchase amount must be greater than 0");
        
        // 1. 获取订单信息
        IOrderBook orderBook_ = IOrderBook(orderBook);
        IOrderBook.Order memory order = orderBook_.getOrder(orderId);
        
        // 2. 验证订单状态
        require(order.status == IOrderBook.OrderStatus.Active, "Order not active");
        uint256 remainingAmount = order.amount - order.filledAmount;
        require(purchaseAmount <= remainingAmount, "Purchase amount exceeds remaining");
        
        // 3. 提取订单和卖家信息
        address seller = order.seller;
        uint256 orderLastDividendTime = order.lastDividendTime;  // 订单创建时的分红时间
        uint256 orderLastLiquidationClaimTime = order.lastLiquidationClaimTime;  // 订单创建时的清算时间
        uint256 currentTime = block.timestamp;
        
        // 4. 计算并转移期间分红给卖家
        // 从订单创建时间到现在，卖家应得的分红
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
        
        // 5. 计算并转移期间清算金给卖家
        if (currentTime > orderLastLiquidationClaimTime && orderLastLiquidationClaimTime != INVALID_TIMESTAMP && liquidateManager != address(0)) {
            uint256 liquidationCount = ILiquidateManager(liquidateManager).findLiquidationTimeRange(
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
        
        // 6. 买家支付稳定币给卖家
        // 支付金额 = 购买数量 × 单价
        uint256 paymentAmount = (purchaseAmount * order.price) / 1e18;
        require(paymentAmount > 0, "Payment amount is zero");
        require(paymentToken != address(0), "Payment token not set");
        require(
            IERC20(paymentToken).transferFrom(msg.sender, seller, paymentAmount),
            "Payment transfer failed"
        );
        
        // 7. 转移 AssetToken 从卖家到买家
        _transfer(seller, msg.sender, purchaseAmount);
        
        // 8. 将买家添加到持有者列表
        _addHolder(msg.sender);
        
        // 9. 创建买家的持有信息
        // 买家从当前时间开始持有，分红和清算时间设为 INVALID_TIMESTAMP
        holderInfo[msg.sender].push(
            HolderInfo({
                shares: purchaseAmount,
                holdingStartTime: currentTime,
                lastDividendTime: INVALID_TIMESTAMP,  // 从未分红
                lastLiquidationClaimTime: INVALID_TIMESTAMP  // 从未领取清算金
            })
        );
        
        // 10. 更新 OrderBook 中的订单状态（已成交数量）
        orderBook_.fillOrder(orderId, purchaseAmount);
    }

    /**
     * @notice 计算指定时间段内的分红金额
     * @param lastDividendTime 上次分红时间（开始时间）
     * @param withdrawTime 提取时间（结束时间）
     * @param holderShares 持有份额数量
     * @return dividendAmount 该份额应得的分红金额
     * @dev 计算公式: (持有份额 / 总供应量) × 期间总收益
     * @dev 使用 RevenueManager 查询期间累计收益差值
     */
    function _calculateDividendAmount(
        uint256 lastDividendTime,
        uint256 withdrawTime,
        uint256 holderShares
    ) internal onlySoldOut() view returns (uint256 dividendAmount) {
        // 安全检查
        if (revenueManager == address(0)) return 0;
        if (withdrawTime <= lastDividendTime) return 0; 
        
        // 查找lastDividendTime（分红起始时间）前的最近累计收益索引
        bool foundStart;
        bool foundEnd;
        uint256 startIndex;
        uint256 endIndex;
        if(lastDividendTime < soldOutTimestamp) {
            // 如果分红起始时间早于售罄时间，则视为未找到有效起始索引
            foundStart = false;

            // 查找时间范围内的最大索引（最晚的收益记录）
            (foundEnd, endIndex) = IRevenueManager(revenueManager).findMaxMarkedIndex(
                soldOutTimestamp,
                withdrawTime
            );
        } else {
            // 在revenueManager中查找介于售罄时间和lastDividendTime之间的最新收益记录的索引
            (foundStart, startIndex) = IRevenueManager(revenueManager).findMaxMarkedIndex(
                soldOutTimestamp,
                lastDividendTime
            );
            // 查找时间范围内的最大索引（最晚的收益记录）
            (foundEnd, endIndex) = IRevenueManager(revenueManager).findMaxMarkedIndex(
                lastDividendTime,
                withdrawTime
            );
        }
        
        // 3. 如果没有找到收益记录，返回0
        if (!foundEnd) return 0;
        
        // 4. 获取两个时间点的累计收益
        uint256 revenueAtMinIndex = foundStart ? IRevenueManager(revenueManager).getAccumulatedRevenueAt(startIndex) : 0;
        uint256 revenueAtMaxIndex = foundEnd   ? IRevenueManager(revenueManager).getAccumulatedRevenueAt(endIndex)   : 0;
        
        // 5. 计算期间总收益（累计收益的差值）
        uint256 periodRevenue = revenueAtMaxIndex - revenueAtMinIndex ;
        
        // 6. 计算该份额应得的分红
        // 公式: (持有份额 / 总发行量) × 期间收益
        uint256 totalSupplyAmount = totalSupply();
        if (totalSupplyAmount == 0) return 0;
        
        dividendAmount = (holderShares * periodRevenue) / totalSupplyAmount;
        
        return dividendAmount;
    }

    /**
     * @notice 添加持有者到列表
     * @param holder 持有者地址
     * @dev 内部函数，用于维护持有者列表
     */
    function _addHolder(address holder) private {
        if (!isHolder[holder] && holder != address(0)) {
            holders.push(holder);
            isHolder[holder] = true;
        }
    }

    /**
     * @notice 从持有者列表移除
     * @param holder 持有者地址
     * @dev 内部函数，标记为非持有者（不从数组删除以节省gas）
     */
    function _removeHolder(address holder) private {
        if (isHolder[holder]) {
            isHolder[holder] = false;
        }
    }

    /**
     * @notice 设置支付代币地址
     * @param _paymentToken 支付代币地址（如 USDT）
     */
    function setPaymentToken(address _paymentToken) external {
        require(_paymentToken != address(0), "Invalid payment token");
        paymentToken = _paymentToken;
    }

    /**
     * @notice 设置抵押品金库合约地址
     * @param _collateralVault 抵押品金库地址
     */
    function setCollateralVault(address _collateralVault) external {
        require(_collateralVault != address(0), "Invalid collateral vault");
        collateralVault = _collateralVault;
    }

    /**
     * @notice 设置清算管理合约地址
     * @param _liquidateManager 清算管理合约地址
     */
    function setLiquidateManager(address _liquidateManager) external {
        require(_liquidateManager != address(0), "Invalid liquidate manager");
        liquidateManager = _liquidateManager;
    }

    /**
     * @notice 设置订单簿合约地址
     * @param _orderBook 订单簿合约地址
     */
    function setOrderBook(address _orderBook) external {
        require(_orderBook != address(0), "Invalid order book");
        orderBook = _orderBook;
    }

    /**
     * @notice 获取持有者的所有订单ID
     * @param holder 持有者地址
     * @return 订单ID数组
     */
    function getHolderOrders(address holder) external view returns (uint256[] memory) {
        return holderOrders[holder];
    }
}

