'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { OrderBookABI } from '@/abi/OrderBook'
import { AssetTokenABI } from '@/abi/AssetToken'
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

export function useSellShares() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const sell = async (amount: bigint, price: bigint, recipient: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.AssetToken,
      abi: AssetTokenABI,
      functionName: 'sellShares',
      args: [amount, price, recipient],
      gas: 500000n,
    })
  }

  return {
    sell,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    hash,
  }
}

export function usePayOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const pay = async (orderId: bigint, purchaseAmount: bigint) => {
    writeContract({
      address: CONTRACTS.AssetToken,
      abi: AssetTokenABI,
      functionName: 'payOrder',
      args: [orderId, purchaseAmount],
      gas: 500000n,
    })
  }

  return {
    pay,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    hash,
  }
}

export function useCancelOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const cancel = async (orderId: bigint) => {
    writeContract({
      address: CONTRACTS.AssetToken,
      abi: AssetTokenABI,
      functionName: 'cancelOrder',
      args: [orderId],
      gas: 300000n,
    })
  }

  return {
    cancel,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    hash,
  }
}

// 获取用户订单数量
export function useUserOrderCount(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'getUserOrderCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })
}

// 获取用户所有订单ID
export function useUserOrders(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'getUserOrders',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000, // 每5秒刷新一次
    },
  })
}

