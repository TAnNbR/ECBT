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

  return {
    withdraw,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
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

