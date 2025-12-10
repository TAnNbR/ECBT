'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useOrder, useCancelOrder, usePayOrder, OrderStatus } from '@/hooks/useOrderBook'
import { useERC20Balance, useERC20Approve, useERC20Allowance } from '@/hooks/useERC20'
import { CONTRACTS } from '@/config/contracts'
import { formatTokenAmount, parseTokenAmount, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { X, ShoppingCart, Loader2 } from 'lucide-react'

type Order = {
  orderId: bigint
  seller: `0x${string}`
  amount: bigint
  price: bigint
  filledAmount: bigint
  status: number
  createdAt: bigint
  lastDividendTime: bigint
  lastLiquidationClaimTime: bigint
}

function parseOrderData(data: any): Order | null {
  if (!data || !Array.isArray(data) || data.length < 9) return null
  return {
    orderId: data[0],
    seller: data[1],
    amount: data[2],
    price: data[3],
    filledAmount: data[4],
    status: data[5],
    createdAt: data[6],
    lastDividendTime: data[7],
    lastLiquidationClaimTime: data[8],
  }
}

export function OrderItem({ 
  orderId,
  userAddress,
  onCancelSuccess
}: { 
  orderId: bigint
  userAddress?: `0x${string}`
  onCancelSuccess?: () => void
}) {
  const { data: orderData } = useOrder(orderId)
  const order = parseOrderData(orderData)
  const { cancel, isPending: isCancelling, isSuccess: isCancelSuccess, hash: cancelHash } = useCancelOrder()

  // 监听取消成功事件 - 必须在所有 hooks 调用完成后才能有条件返回
  useEffect(() => {
    if (isCancelSuccess && cancelHash) {
      toast.success('Order cancelled successfully!', {
        description: 'Your tokens have been unfrozen'
      })
      // 等待2秒让用户看到成功消息，然后刷新
      const timer = setTimeout(() => {
        onCancelSuccess?.()
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [isCancelSuccess, cancelHash, onCancelSuccess])

  const handleCancel = async () => {
    try {
      toast.info('Cancelling order...')
      await cancel(orderId)
      toast.info('Transaction sent! Waiting for confirmation...', {
        description: 'Please wait for the transaction to be confirmed'
      })
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel order')
    }
  }

  // 条件返回必须在所有 hooks 之后
  if (!order) return null

  const isMyOrder = order.seller.toLowerCase() === userAddress?.toLowerCase()
  const status = Number(order.status)
  const remainingAmount = order.amount - order.filledAmount

  // 不显示已取消或已完成且无剩余的订单
  if (status === OrderStatus.Cancelled || (status === OrderStatus.Filled && remainingAmount === 0n)) {
    return null
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Order #{orderId.toString()}</span>
            {status === OrderStatus.Active && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Active</span>
            )}
            {status === OrderStatus.Filled && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Filled</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Seller: {order.seller.slice(0, 6)}...{order.seller.slice(-4)}
          </div>
        </div>
        {isMyOrder && status === OrderStatus.Active && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Cancelling...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Amount:</span>
          <span className="ml-2 font-medium">
            {formatTokenAmount(remainingAmount)} / {formatTokenAmount(order.amount)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Price:</span>
          <span className="ml-2 font-medium">
            {formatTokenAmount(order.price, 18)} USDT/token
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Filled:</span>
          <span className="ml-2 font-medium">{formatTokenAmount(order.filledAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Status:</span>
          <span className="ml-2 font-medium">
            {status === OrderStatus.Active ? 'Active' : status === OrderStatus.Filled ? 'Filled' : 'Cancelled'}
          </span>
        </div>
      </div>

      {!isMyOrder && status === OrderStatus.Active && remainingAmount > 0n && (
        <BuyDialog orderId={orderId} order={order} remainingAmount={remainingAmount} />
      )}
    </Card>
  )
}

function BuyDialog({ 
  orderId, 
  order, 
  remainingAmount 
}: { 
  orderId: bigint
  order: Order
  remainingAmount: bigint
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const { address } = useAccount()
  const { pay, isPending, isSuccess: isPaySuccess, hash: payHash } = usePayOrder()
  const { data: usdtBalance } = useERC20Balance(CONTRACTS.PaymentToken, address)
  const { approve, isPending: isApproving } = useERC20Approve()
  const { data: allowance, refetch: refetchAllowance } = useERC20Allowance(
    CONTRACTS.PaymentToken,
    address,
    CONTRACTS.AssetToken
  )

  const handleBuy = async () => {
    if (!amount || !address) return

    try {
      const amountBigInt = parseTokenAmount(amount, 18)
      
      if (amountBigInt > remainingAmount) {
        toast.error('Amount exceeds available')
        return
      }

      // 计算需要支付的金额
      const paymentAmount = (amountBigInt * order.price) / parseTokenAmount('1', 18)

      // 检查授权
      if (!allowance || allowance < paymentAmount) {
        toast.info('Approving USDT...')
        await approve(CONTRACTS.PaymentToken, CONTRACTS.AssetToken, paymentAmount * 2n)
        await refetchAllowance()
        toast.success('Approval successful!')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      toast.info('Purchasing tokens...')
      await pay(orderId, amountBigInt)
      toast.info('Transaction sent! Waiting for confirmation...', {
        description: 'Please wait for the transaction to be confirmed'
      })
      setAmount('')
    } catch (error: any) {
      toast.error(error?.message || 'Purchase failed')
    }
  }

  // 监听购买成功事件
  useEffect(() => {
    if (isPaySuccess && payHash) {
      toast.success('Purchase completed successfully!', {
        description: 'Tokens have been transferred to your wallet'
      })
      setOpen(false)
      // 等待2秒后刷新页面
      const timer = setTimeout(() => {
        window.location.reload()
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [isPaySuccess, payHash])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full mt-3">
          <ShoppingCart className="mr-2 h-4 w-4" />
          Buy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purchase from Order #{orderId.toString()}</DialogTitle>
          <DialogDescription>
            Available: {formatTokenAmount(remainingAmount)} tokens
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount to purchase</label>
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending || isApproving}
            />
            <p className="text-xs text-muted-foreground">
              Max: {formatTokenAmount(remainingAmount)}
            </p>
          </div>

          {amount && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price per token:</span>
                <span className="font-medium">
                  {formatTokenAmount(order.price, 18)} USDT
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Cost:</span>
                <span className="font-medium">
                  {formatCurrency(
                    formatTokenAmount(
                      (parseTokenAmount(amount, 18) * order.price) / parseTokenAmount('1', 18),
                      18
                    )
                  )} USDT
                </span>
              </div>
              {usdtBalance && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Balance:</span>
                  <span className="font-medium">
                    {formatCurrency(formatTokenAmount(usdtBalance, 6))} USDT
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending || isApproving}>
            Cancel
          </Button>
          <Button onClick={handleBuy} disabled={isPending || isApproving || !amount}>
            {(isPending || isApproving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isApproving ? 'Approving...' : isPending ? 'Purchasing...' : 'Purchase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

