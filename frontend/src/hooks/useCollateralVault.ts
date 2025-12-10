'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CollateralVaultABI } from '@/abi/CollateralVault'
import { CONTRACTS } from '@/config/contracts'

/**
 * 获取总募集资金金额
 */
export function useTotalFundraisedAmount() {
  return useReadContract({
    address: CONTRACTS.CollateralVault,
    abi: CollateralVaultABI,
    functionName: 'totalFundraisedAmount',
    query: {
      refetchInterval: 5000,
    },
  })
}

/**
 * 获取已提取募集资金金额
 */
export function useTotalWithdrawnFundraise() {
  return useReadContract({
    address: CONTRACTS.CollateralVault,
    abi: CollateralVaultABI,
    functionName: 'totalWithdrawnFundraise',
    query: {
      refetchInterval: 5000,
    },
  })
}

/**
 * 获取当前收益额
 */
export function useCurrentRevenue() {
  return useReadContract({
    address: CONTRACTS.CollateralVault,
    abi: CollateralVaultABI,
    functionName: 'currentRevenue',
    query: {
      refetchInterval: 5000,
    },
  })
}

/**
 * 获取已分配收益额
 */
export function useDistributedRevenue() {
  return useReadContract({
    address: CONTRACTS.CollateralVault,
    abi: CollateralVaultABI,
    functionName: 'distributedRevenue',
    query: {
      refetchInterval: 5000,
    },
  })
}

/**
 * 获取已存入收益额
 */
export function useDepositedRevenue() {
  return useReadContract({
    address: CONTRACTS.CollateralVault,
    abi: CollateralVaultABI,
    functionName: 'depositedRevenue',
    query: {
      refetchInterval: 5000,
    },
  })
}

/**
 * 获取总押金金额
 */
export function useTotalCollateralAmount() {
  return useReadContract({
    address: CONTRACTS.CollateralVault,
    abi: CollateralVaultABI,
    functionName: 'totalCollateralAmount',
    query: {
      refetchInterval: 5000,
    },
  })
}

/**
 * 获取可清算押金金额
 */
export function useLiquidatableCollateralAmount() {
  return useReadContract({
    address: CONTRACTS.CollateralVault,
    abi: CollateralVaultABI,
    functionName: 'liquidatableCollateralAmount',
    query: {
      refetchInterval: 5000,
    },
  })
}

/**
 * 获取 CollateralVault 的完整状态
 */
export function useCollateralVaultStatus() {
  const { data: totalFundraised } = useTotalFundraisedAmount()
  const { data: withdrawnFundraise } = useTotalWithdrawnFundraise()
  const { data: currentRevenue } = useCurrentRevenue()
  const { data: distributedRevenue } = useDistributedRevenue()
  const { data: depositedRevenue } = useDepositedRevenue()
  const { data: totalCollateral } = useTotalCollateralAmount()
  const { data: liquidatableCollateral } = useLiquidatableCollateralAmount()

  return {
    totalFundraised: totalFundraised || 0n,
    withdrawnFundraise: withdrawnFundraise || 0n,
    currentRevenue: currentRevenue || 0n,
    distributedRevenue: distributedRevenue || 0n,
    depositedRevenue: depositedRevenue || 0n,
    totalCollateral: totalCollateral || 0n,
    liquidatableCollateral: liquidatableCollateral || 0n,
    // 计算可用余额
    availableFundraise: (totalFundraised || 0n) - (withdrawnFundraise || 0n),
    availableRevenue: (depositedRevenue || 0n) - (distributedRevenue || 0n),
  }
}

/**
 * 存入押金（仅 SPV 用户）
 */
export function useDepositCollateral() {
  const { writeContract, data: hash, isPending, isSuccess, error } = useWriteContract()

  const deposit = (amount: bigint) => {
    writeContract({
      address: CONTRACTS.CollateralVault,
      abi: CollateralVaultABI,
      functionName: 'depositCollateralByProvider',
      args: [amount],
    })
  }

  return {
    deposit,
    hash,
    isPending,
    isSuccess,
    error,
  }
}

/**
 * 存入收益（仅 SPV 用户）
 */
export function useDepositRevenue() {
  const { writeContract, data: hash, isPending, isSuccess, error } = useWriteContract()

  const deposit = (amount: bigint) => {
    writeContract({
      address: CONTRACTS.CollateralVault,
      abi: CollateralVaultABI,
      functionName: 'depositRevenue',
      args: [amount],
    })
  }

  return {
    deposit,
    hash,
    isPending,
    isSuccess,
    error,
  }
}

