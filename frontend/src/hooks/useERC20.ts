'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ERC20ABI } from '@/abi/ERC20'

export function useERC20Balance(tokenAddress?: `0x${string}`, userAddress?: `0x${string}`) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!userAddress,
    },
  })
}

export function useERC20Allowance(
  tokenAddress?: `0x${string}`,
  owner?: `0x${string}`,
  spender?: `0x${string}`
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: !!tokenAddress && !!owner && !!spender,
    },
  })
}

export function useERC20Approve() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = async (tokenAddress: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  return {
    approve,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    hash,
  }
}

export function useERC20Info(tokenAddress?: `0x${string}`) {
  const { data: name } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'name',
    query: { enabled: !!tokenAddress },
  })

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'symbol',
    query: { enabled: !!tokenAddress },
  })

  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'decimals',
    query: { enabled: !!tokenAddress },
  })

  return { name, symbol, decimals }
}

