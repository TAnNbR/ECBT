'use client'

import { useEffect, useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { CONTRACTS } from '@/config/contracts'
import { AssetTokenABI } from '@/abi/AssetToken'

/**
 * 查看应得分红金额（只读，不实际提取）
 * 
 * 使用 Uniswap V3 quoter 模式：通过 simulateContract (eth_call/staticcall) 调用 withdrawDividend
 * 
 * 工作原理：
 * - 使用 simulateContract (基于 eth_call) 来调用 withdrawDividend
 * - withdrawDividend 会执行所有计算逻辑
 * - 但因为是 staticcall，不会实际改变链上状态
 * - 返回计算出的分红金额
 * 
 * 优点：
 * - 不需要修改合约代码
 * - 复用现有的 withdrawDividend 逻辑  
 * - 零 gas 费用（只是模拟查询）
 */
export function useViewDividend(holder?: `0x${string}`) {
  const publicClient = usePublicClient()
  const [dividendAmount, setDividendAmount] = useState<bigint>(0n)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchDividend = async () => {
    if (!holder || !publicClient) {
      setDividendAmount(0n)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 使用 simulateContract 模拟调用 withdrawDividend
      // 这会使用 eth_call，不会实际改变状态
      const { result } = await publicClient.simulateContract({
        address: CONTRACTS.AssetToken,
        abi: AssetTokenABI,
        functionName: 'withdrawDividend',
        args: [holder, holder],
        account: holder, // 使用持有者地址作为 from
      })

      setDividendAmount(result as bigint)
    } catch (err: any) {
      console.log('View dividend error:', err.message)
      setError(err)
      setDividendAmount(0n)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDividend()

    // 每10秒自动刷新
    const interval = setInterval(fetchDividend, 10000)
    return () => clearInterval(interval)
  }, [holder, publicClient])

  return {
    dividendAmount,
    isLoading,
    error,
    refetch: fetchDividend,
  }
}

/**
 * 查看当前用户的应得分红
 */
export function useMyDividend() {
  const { address } = useAccount()
  return useViewDividend(address)
}

