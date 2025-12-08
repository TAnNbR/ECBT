'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { AssetTokenABI } from '@/abi/AssetToken'
import { CONTRACTS } from '@/config/contracts'
import { useState } from 'react'

export function useAssetTokenMetadata() {
  return useReadContract({
    address: CONTRACTS.AssetToken,
    abi: AssetTokenABI,
    functionName: 'metadata',
  })
}

export function useAssetTokenBalance(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.AssetToken,
    abi: AssetTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })
}

export function useFrozenAmount(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.AssetToken,
    abi: AssetTokenABI,
    functionName: 'frozenAmounts',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })
}

export function useRemainingSupply() {
  return useReadContract({
    address: CONTRACTS.AssetToken,
    abi: AssetTokenABI,
    functionName: 'remainingMintableSupply',
  })
}

export function useTotalSupply() {
  return useReadContract({
    address: CONTRACTS.AssetToken,
    abi: AssetTokenABI,
    functionName: 'totalSupply',
  })
}

export function useSoldOutTimestamp() {
  return useReadContract({
    address: CONTRACTS.AssetToken,
    abi: AssetTokenABI,
    functionName: 'soldOutTimestamp',
  })
}

export function useHolderInfo(address?: `0x${string}`, index: number = 0) {
  return useReadContract({
    address: CONTRACTS.AssetToken,
    abi: AssetTokenABI,
    functionName: 'holderInfo',
    args: address ? [address, BigInt(index)] : undefined,
    query: {
      enabled: !!address,
    },
  })
}

export function usePurchaseToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const purchase = async (amount: bigint) => {
    writeContract({
      address: CONTRACTS.AssetToken,
      abi: AssetTokenABI,
      functionName: 'purchase',
      args: [amount],
    })
  }

  return {
    purchase,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    hash,
  }
}

export function useWithdrawDividend() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const withdraw = async (recipient: `0x${string}`, holder: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.AssetToken,
      abi: AssetTokenABI,
      functionName: 'withdrawDividend',
      args: [recipient, holder],
    })
  }

  // 解析错误消息，提取合约 revert 的原因
  const parseErrorMessage = (error: any): string => {
    if (!error) return ''
    
    // 从错误消息中提取 revert 原因
    const message = error.message || error.toString()
    
    // 常见的合约错误模式
    const revertMatch = message.match(/reverted with reason string '([^']+)'/)
    if (revertMatch) return revertMatch[1]
    
    const customErrorMatch = message.match(/reverted with custom error '([^']+)'/)
    if (customErrorMatch) return customErrorMatch[1]
    
    // 返回原始消息
    return message
  }

  return {
    withdraw,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    errorMessage: parseErrorMessage(error), // ✨ 新增：解析后的错误消息
    hash,
  }
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

