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
import { usePurchaseToken, useAssetTokenMetadata } from '@/hooks/useAssetToken'
import { useERC20Approve, useERC20Allowance, useERC20Balance } from '@/hooks/useERC20'
import { CONTRACTS } from '@/config/contracts'
import { parseTokenAmount, formatTokenAmount, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ShoppingCart, Loader2, CheckCircle2 } from 'lucide-react'

export function PurchaseModal() {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [isApproved, setIsApproved] = useState(false)
  const { address } = useAccount()
  const { data: metadata } = useAssetTokenMetadata()
  const { purchase, isPending: isPurchasing, isSuccess: purchaseSuccess } = usePurchaseToken()
  const { approve, isPending: isApproving, isSuccess: approveSuccess } = useERC20Approve()
  
  const { data: paymentBalance } = useERC20Balance(CONTRACTS.PaymentToken, address)
  const { data: allowance, refetch: refetchAllowance } = useERC20Allowance(
    CONTRACTS.PaymentToken,
    address,
    CONTRACTS.AssetToken
  )

  // Calculate required payment
  const calculatePaymentAmount = () => {
    if (!amount || !metadata) return 0n
    try {
      const amountBigInt = parseTokenAmount(amount, 18)
      const [, , , fundraiseAmount, maxTotalSupply] = metadata
      return (amountBigInt * fundraiseAmount) / maxTotalSupply
    } catch {
      return 0n
    }
  }

  const paymentAmount = calculatePaymentAmount()

  // Check if already approved
  useEffect(() => {
    if (allowance && paymentAmount > 0n) {
      const approved = allowance >= paymentAmount
      console.log('Approval check:', {
        allowance: allowance.toString(),
        paymentAmount: paymentAmount.toString(),
        approved
      })
      setIsApproved(approved)
    } else {
      setIsApproved(false)
    }
  }, [allowance, paymentAmount])

  // Refresh allowance after approval
  useEffect(() => {
    if (approveSuccess) {
      console.log('Approval success, refetching allowance...')
      toast.success('Approval successful! Refreshing...')
      
      // 多次重试刷新 allowance，确保获取到最新值
      const refetchMultipleTimes = async () => {
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          await refetchAllowance()
          console.log(`Refetch attempt ${i + 1}/5`)
        }
        toast.success('Ready to buy tokens!')
      }
      
      refetchMultipleTimes()
    }
  }, [approveSuccess, refetchAllowance])

  // Close modal and reset after successful purchase
  useEffect(() => {
    if (purchaseSuccess) {
      toast.success('Purchase successful!')
      setTimeout(() => {
        setOpen(false)
        setAmount('')
        setIsApproved(false)
        window.location.reload()
      }, 2000)
    }
  }, [purchaseSuccess])

  const handleApprove = async () => {
    if (!amount || !metadata || paymentAmount === 0n) return

    try {
      console.log('Approving:', {
        token: CONTRACTS.PaymentToken,
        spender: CONTRACTS.AssetToken,
        amount: (paymentAmount * 2n).toString()
      })
      
      toast.info('Approving USDT...')
      await approve(CONTRACTS.PaymentToken, CONTRACTS.AssetToken, paymentAmount * 2n)
    } catch (error: any) {
      console.error('Approval error:', error)
      toast.error(error?.message || 'Approval failed')
    }
  }

  const handlePurchase = async () => {
    if (!amount || !metadata || !isApproved) {
      console.log('Purchase blocked:', { amount, metadata: !!metadata, isApproved })
      if (!isApproved) {
        toast.error('Please approve USDT first!')
      }
      return
    }

    try {
      const amountBigInt = parseTokenAmount(amount, 18)
      console.log('Purchasing:', {
        amountBigInt: amountBigInt.toString(),
        paymentAmount: paymentAmount.toString(),
        allowance: allowance?.toString(),
      })
      
      toast.info('Purchasing tokens...')
      await purchase(amountBigInt)
    } catch (error: any) {
      console.error('Purchase error:', error)
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
            Step 1: Approve USDT spending. Step 2: Buy tokens. Both steps are required.
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
            {allowance !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Allowance:</span>
                <span className="font-medium">{formatTokenAmount(allowance, 6)} USDT</span>
              </div>
            )}
          </div>

          {/* Status indicator */}
          {amount && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {isApproved ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={isApproved ? "text-green-600 font-medium" : "text-muted-foreground"}>
                  Step 1: Approve USDT {isApproved && '✓'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-4 w-4 rounded-full border-2 ${isApproved ? 'border-primary' : 'border-muted-foreground'}`} />
                <span className={isApproved ? "text-foreground" : "text-muted-foreground"}>
                  Step 2: Buy Tokens {!isApproved && '(waiting for approval)'}
                </span>
              </div>
              
              {isApproved && (
                <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Approved! You can now click &quot;2. Buy&quot;</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setOpen(false)
              setAmount('')
              setIsApproved(false)
            }} 
            disabled={isPurchasing || isApproving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              onClick={handleApprove} 
              disabled={isApproving || isPurchasing || !amount || isApproved}
              variant={isApproved ? "secondary" : "default"}
              className="flex-1 sm:flex-none"
            >
              {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isApproved && <CheckCircle2 className="mr-2 h-4 w-4" />}
              {isApproved ? 'Approved' : '1. Approve'}
            </Button>
            
            <Button 
              onClick={handlePurchase} 
              disabled={isPurchasing || isApproving || !amount || !isApproved}
              className="flex-1 sm:flex-none"
            >
              {isPurchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPurchasing ? 'Buying...' : '2. Buy'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

