'use client'

import { useReadContract } from 'wagmi'
import { CONTRACTS } from '@/config/contracts'

// RevenueManager ABI (只包含需要的函数)
const RevenueManagerABI = [
  {
    inputs: [],
    name: 'getCurrentAccumulatedRevenue',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getUnitSeconds',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'timestamp', type: 'uint256' }],
    name: 'getAccumulatedRevenueAt',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastestAccumulatedRevenue',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/**
 * 获取当前累计总收益
 */
export function useCurrentAccumulatedRevenue() {
  return useReadContract({
    address: CONTRACTS.RevenueManager,
    abi: RevenueManagerABI,
    functionName: 'getCurrentAccumulatedRevenue',
  })
}

/**
 * 获取时间单位（秒）
 */
export function useUnitSeconds() {
  return useReadContract({
    address: CONTRACTS.RevenueManager,
    abi: RevenueManagerABI,
    functionName: 'getUnitSeconds',
  })
}

/**
 * 获取指定时间戳的累计收益
 */
export function useAccumulatedRevenueAt(timestamp?: bigint) {
  return useReadContract({
    address: CONTRACTS.RevenueManager,
    abi: RevenueManagerABI,
    functionName: 'getAccumulatedRevenueAt',
    args: timestamp ? [timestamp] : undefined,
    query: {
      enabled: !!timestamp,
    },
  })
}

