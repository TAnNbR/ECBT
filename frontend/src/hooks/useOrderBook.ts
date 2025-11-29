'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { OrderBookABI } from '@/abi/OrderBook'
import { CONTRACTS } from '@/config/contracts'

export function useOrder(orderId?: bigint) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'orders',
    args: orderId !== undefined ? [orderId] : undefined,
    query: {
      enabled: orderId !== undefined,
    },
  })
}

export function useNextOrderId() {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'nextOrderId',
  })
}

export function useUserOrder(address?: `0x${string}`, index: number = 0) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'userOrders',
    args: address ? [address, BigInt(index)] : undefined,
    query: {
      enabled: !!address,
    },
  })
}

export function useFeeRate() {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'feeRate',
  })
}

export enum OrderStatus {
  Active = 0,
  Filled = 1,
  Cancelled = 2,
}

export type Order = {
  orderId: bigint
  seller: `0x${string}`
  amount: bigint
  price: bigint
  filledAmount: bigint
  status: OrderStatus
  createdAt: bigint
  lastDividendTime: bigint
  lastLiquidationClaimTime: bigint
}

