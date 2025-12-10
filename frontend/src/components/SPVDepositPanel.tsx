'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAssetTokenMetadata } from '@/hooks/useAssetToken'
import { useDepositCollateral, useDepositRevenue } from '@/hooks/useCollateralVault'
import { useERC20Balance, useERC20Approve } from '@/hooks/useERC20'
import { CONTRACTS } from '@/config/contracts'
import { formatTokenAmount, parseTokenAmount } from '@/lib/utils'
import { Shield, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

export function SPVDepositPanel() {
  const { address } = useAccount()
  const { data: metadata, isLoading: isLoadingMetadata } = useAssetTokenMetadata()
  const { data: usdtBalance } = useERC20Balance(CONTRACTS.PaymentToken, address)

  const [collateralAmount, setCollateralAmount] = useState('')
  const [revenueAmount, setRevenueAmount] = useState('')

  // Deposit hooks
  const { 
    deposit: depositCollateral, 
    isPending: isDepositingCollateral,
    isSuccess: isCollateralSuccess,
    hash: collateralHash,
  } = useDepositCollateral()

  const { 
    deposit: depositRevenue, 
    isPending: isDepositingRevenue,
    isSuccess: isRevenueSuccess,
    hash: revenueHash,
  } = useDepositRevenue()

  // Approve hooks
  const {
    approve: approveCollateral,
    isPending: isApprovingCollateral,
  } = useERC20Approve()

  const {
    approve: approveRevenue,
    isPending: isApprovingRevenue,
  } = useERC20Approve()

  // Check if current user is SPV
  // metadata can be returned as array or object
  const spvAddress = metadata 
    ? (Array.isArray(metadata) ? metadata[5] : metadata.specialPurposeVehicle)
    : undefined

  // Debug log (can be removed later)
  useEffect(() => {
    if (metadata) {
      console.log('Metadata:', metadata)
      console.log('SPV Address:', spvAddress)
      console.log('Current Address:', address)
      console.log('Is Array:', Array.isArray(metadata))
    }
  }, [metadata, spvAddress, address])

  const isSPV = Boolean(
    !isLoadingMetadata &&
    spvAddress && 
    address && 
    (spvAddress as string).toLowerCase() === address.toLowerCase()
  )

  // Refresh page after successful deposit
  useEffect(() => {
    if (isCollateralSuccess && collateralHash) {
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }, [isCollateralSuccess, collateralHash])

  useEffect(() => {
    if (isRevenueSuccess && revenueHash) {
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }, [isRevenueSuccess, revenueHash])

  // Don't render while loading
  if (isLoadingMetadata) {
    return null
  }

  // Don't show this panel for non-SPV users
  if (!isSPV) {
    return null
  }

  const handleApproveCollateral = async () => {
    if (!collateralAmount) return
    const amount = parseTokenAmount(collateralAmount, 6)
    await approveCollateral(CONTRACTS.PaymentToken, CONTRACTS.CollateralVault, amount)
  }

  const handleDepositCollateral = async () => {
    if (!collateralAmount) return
    const amount = parseTokenAmount(collateralAmount, 6)
    depositCollateral(amount)
  }

  const handleApproveRevenue = async () => {
    if (!revenueAmount) return
    const amount = parseTokenAmount(revenueAmount, 6)
    await approveRevenue(CONTRACTS.PaymentToken, CONTRACTS.CollateralVault, amount)
  }

  const handleDepositRevenue = async () => {
    if (!revenueAmount) return
    const amount = parseTokenAmount(revenueAmount, 6)
    depositRevenue(amount)
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-900">SPV Panel</p>
          <p className="text-sm text-blue-700 mt-1">
            You are the Special Purpose Vehicle (SPV) for this asset. You can deposit collateral and revenue.
          </p>
          <p className="text-sm text-blue-700 mt-1">
            Your USDT Balance: {usdtBalance ? formatTokenAmount(usdtBalance, 6) : '0.00'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Deposit Collateral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Deposit Collateral
            </CardTitle>
            <CardDescription>Deposit collateral to the vault (USDT)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (USDT)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                disabled={isApprovingCollateral || isDepositingCollateral}
              />
            </div>

            {isCollateralSuccess ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Collateral deposited successfully!</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handleApproveCollateral}
                  disabled={!collateralAmount || isApprovingCollateral || isDepositingCollateral}
                  className="w-full"
                  variant="outline"
                >
                  {isApprovingCollateral ? 'Approving...' : '1. Approve USDT'}
                </Button>

                <Button
                  onClick={handleDepositCollateral}
                  disabled={!collateralAmount || isDepositingCollateral}
                  className="w-full"
                >
                  {isDepositingCollateral ? 'Depositing...' : '2. Deposit Collateral'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deposit Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Deposit Revenue
            </CardTitle>
            <CardDescription>Deposit revenue to the vault (USDT)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (USDT)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={revenueAmount}
                onChange={(e) => setRevenueAmount(e.target.value)}
                disabled={isApprovingRevenue || isDepositingRevenue}
              />
            </div>

            {isRevenueSuccess ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Revenue deposited successfully!</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handleApproveRevenue}
                  disabled={!revenueAmount || isApprovingRevenue || isDepositingRevenue}
                  className="w-full"
                  variant="outline"
                >
                  {isApprovingRevenue ? 'Approving...' : '1. Approve USDT'}
                </Button>

                <Button
                  onClick={handleDepositRevenue}
                  disabled={!revenueAmount || isDepositingRevenue}
                  className="w-full"
                >
                  {isDepositingRevenue ? 'Depositing...' : '2. Deposit Revenue'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

