'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSellShares } from '@/hooks/useAssetToken'
import { parseTokenAmount, formatTokenAmount } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'

export function SellOrderDialog({ availableBalance }: { availableBalance: bigint }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const { address } = useAccount()
  const { sell, isPending, isSuccess, hash } = useSellShares()

  const handleSell = async () => {
    if (!address || !amount || !price) return

    try {
      const amountBigInt = parseTokenAmount(amount, 18)
      const priceBigInt = parseTokenAmount(price, 18)

      if (amountBigInt > availableBalance) {
        toast.error('Amount exceeds available balance')
        return
      }

      toast.info('Creating sell order...')
      await sell(amountBigInt, priceBigInt, address)
      
      toast.info('Transaction sent! Waiting for confirmation...', {
        description: 'Please wait for the order to be created'
      })
      setAmount('')
      setPrice('')
    } catch (error: any) {
      console.error('Sell error:', error)
      toast.error(error?.message || 'Failed to create sell order')
    }
  }

  // 监听订单创建成功事件
  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Sell order created successfully!', {
        description: 'Your order is now active in the market'
      })
      setOpen(false)
      // 等待2秒后刷新页面
      const timer = setTimeout(() => {
        window.location.reload()
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [isSuccess, hash])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Sell Order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sell Order</DialogTitle>
          <DialogDescription>
            Sell your asset tokens on the order book
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Available: {formatTokenAmount(availableBalance)}
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Price (USDT per token)</label>
            <Input
              type="number"
              placeholder="0.5"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Set your desired price per token
            </p>
          </div>

          {amount && price && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Value:</span>
                <span className="font-medium">
                  ${(parseFloat(amount) * parseFloat(price)).toFixed(2)} USDT
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSell} disabled={isPending || !amount || !price}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? 'Creating...' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

