export const AssetTokenABI = [
  // 读取函数
  {
    inputs: [],
    name: 'metadata',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'totalValue', type: 'uint256' },
      { name: 'fundraiseAmount', type: 'uint256' },
      { name: 'maxTotalSupply', type: 'uint256' },
      { name: 'specialPurposeVehicle', type: 'address' },
      { name: 'provider', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paymentToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'collateralVault',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'orderBook',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'remainingMintableSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'frozenAmounts',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'holder', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'holderInfo',
    outputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'holdingStartTime', type: 'uint256' },
      { name: 'lastDividendTime', type: 'uint256' },
      { name: 'lastLiquidationClaimTime', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'holder', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'holderOrders',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // 写入函数
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'purchase',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'holder', type: 'address' },
    ],
    name: 'withdrawDividend',
    outputs: [{ name: 'dividendAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    name: 'sellShares',
    outputs: [{ name: '', type: 'uint256' }],
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
  {
    inputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'purchaseAmount', type: 'uint256' },
    ],
    name: 'payOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

