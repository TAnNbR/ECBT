export const OrderBookABI = [
  // 读取函数
  {
    inputs: [{ name: 'orderId', type: 'uint256' }],
    name: 'orders',
    outputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'seller', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'filledAmount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'lastDividendTime', type: 'uint256' },
      { name: 'lastLiquidationClaimTime', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextOrderId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'userOrders',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeCollector',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserOrders',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserOrderCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // 写入函数
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'lastDividendTime', type: 'uint256' },
      { name: 'lastLiquidationClaimTime', type: 'uint256' },
    ],
    name: 'createSellOrder',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'fillOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'orderId', type: 'uint256' }],
    name: 'cancelOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  
  // 事件
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'price', type: 'uint256' },
    ],
    name: 'OrderCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: false, name: 'filledAmount', type: 'uint256' },
      { indexed: false, name: 'remainingAmount', type: 'uint256' },
      { indexed: false, name: 'totalPayment', type: 'uint256' },
    ],
    name: 'OrderFilled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: false, name: 'refundedAmount', type: 'uint256' },
    ],
    name: 'OrderCancelled',
    type: 'event',
  },
] as const

