export const CONTRACTS = {
  AssetToken: process.env.NEXT_PUBLIC_ASSET_TOKEN_ADDRESS as `0x${string}`,
  CollateralVault: process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS as `0x${string}`,
  RevenueManager: process.env.NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS as `0x${string}`,
  LiquidateManager: process.env.NEXT_PUBLIC_LIQUIDATE_MANAGER_ADDRESS as `0x${string}`,
  OrderBook: process.env.NEXT_PUBLIC_ORDER_BOOK_ADDRESS as `0x${string}`,
  PaymentToken: process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS as `0x${string}`,
} as const

export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337')
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'

