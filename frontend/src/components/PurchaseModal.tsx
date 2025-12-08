'use client'

import { useState } from 'react'
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
import { usePurchaseToken, useAssetTokenMetadata } from '@/hooks/useAssetToken'
import { useERC20Approve, useERC20Allowance, useERC20Balance } from '@/hooks/useERC20'
import { CONTRACTS } from '@/config/contracts'
import { parseTokenAmount, formatTokenAmount, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ShoppingCart, Loader2 } from 'lucide-react'

export function PurchaseModal() {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const { address } = useAccount()
  const { data: metadata } = useAssetTokenMetadata()
  const { purchase, isPending: isPurchasing, isSuccess: purchaseSuccess } = usePurchaseToken()
  const { approve, isPending: isApproving, isSuccess: approveSuccess } = useERC20Approve()
  
  const { data: paymentBalance } = useERC20Balance(CONTRACTS.PaymentToken, address)
  const { data: allowance, refetch: refetchAllowance } = useERC20Allowance(
    CONTRACTS.PaymentToken,
    address,
    CONTRACTS.AssetToken  // ✅ 修复：授权给 AssetToken 合约
  )

  const handlePurchase = async () => {
    if (!amount || !metadata) return

    try {
      const amountBigInt = parseTokenAmount(amount, 18)
      const [, , , fundraiseAmount, maxTotalSupply] = metadata
      const paymentAmount = (amountBigInt * fundraiseAmount) / maxTotalSupply

      // Check if approval needed
      if (!allowance || allowance < paymentAmount) {
        toast.info('Approving payment token...')
        await approve(CONTRACTS.PaymentToken, CONTRACTS.AssetToken, paymentAmount * 2n)  // ✅ 修复：授权给 AssetToken 合约
        await refetchAllowance()
        toast.success('Approval successful!')
      }

      // Purchase tokens
      toast.info('Purchasing tokens...')
      await purchase(amountBigInt)
      toast.success('Purchase successful!')
      setOpen(false)
      setAmount('')
    } catch (error: any) {
      toast.error(error?.message || 'Purchase failed')
    }
  }

  const calculatePayment = () => {
    if (!amount || !metadata) return '0'
    try {
      const amountBigInt = parseTokenAmount(amount, 18)
      const [, , , fundraiseAmount, maxTotalSupply] = metadata
      const paymentAmount = (amountBigInt * fundraiseAmount) / maxTotalSupply
      return formatTokenAmount(paymentAmount, 6)
    } catch {
      return '0'
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full md:w-auto">
          <ShoppingCart className="mr-2 h-4 w-4" />
          Purchase Tokens
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purchase Asset Tokens</DialogTitle>
          <DialogDescription>
            Enter the amount of tokens you want to purchase. You&apos;ll need to approve the payment first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount
            </label>
            <Input
              id="amount"
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPurchasing || isApproving}
            />
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Required:</span>
              <span className="font-medium">{formatCurrency(calculatePayment())} USDT</span>
            </div>
            {paymentBalance && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Balance:</span>
                <span className="font-medium">{formatTokenAmount(paymentBalance, 6)} USDT</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPurchasing || isApproving}>
            Cancel
          </Button>
          <Button onClick={handlePurchase} disabled={isPurchasing || isApproving || !amount}>
            {(isPurchasing || isApproving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isApproving ? 'Approving...' : isPurchasing ? 'Purchasing...' : 'Purchase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

