'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCollateralVaultStatus } from '@/hooks/useCollateralVault'
import { formatTokenAmount, formatCurrency } from '@/lib/utils'
import { 
  Vault, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PiggyBank, 
  Coins,
  AlertCircle
} from 'lucide-react'

export function CollateralVaultInfo() {
  const vaultStatus = useCollateralVaultStatus()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Vault className="h-6 w-6" />
          Collateral Vault Status
        </h2>
        <p className="text-muted-foreground">
          Real-time status of the collateral vault
        </p>
      </div>

      {/* Fundraise Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-500" />
            Fundraise Status
          </CardTitle>
          <CardDescription>Fundraising capital status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Fundraised Amount</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(formatTokenAmount(vaultStatus.totalFundraised, 6))}
              </p>
              <p className="text-xs text-muted-foreground font-mono">totalFundraisedAmount</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Withdrawn Fundraise</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(formatTokenAmount(vaultStatus.withdrawnFundraise, 6))}
              </p>
              <p className="text-xs text-muted-foreground font-mono">totalWithdrawnFundraise</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Available Fundraise</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(formatTokenAmount(vaultStatus.availableFundraise, 6))}
              </p>
              <p className="text-xs text-muted-foreground">Calculated value</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Revenue Status
          </CardTitle>
          <CardDescription>Revenue fund status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Revenue</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(formatTokenAmount(vaultStatus.currentRevenue, 6))}
              </p>
              <p className="text-xs text-muted-foreground font-mono">currentRevenue (USDT, 6 decimals)</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Deposited Revenue</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(formatTokenAmount(vaultStatus.depositedRevenue, 6))}
              </p>
              <p className="text-xs text-muted-foreground font-mono">depositedRevenue (USDT, 6 decimals)</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Distributed Revenue</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(formatTokenAmount(vaultStatus.distributedRevenue, 6))}
              </p>
              <p className="text-xs text-muted-foreground font-mono">distributedRevenue (USDT, 6 decimals)</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Available Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(formatTokenAmount(vaultStatus.availableRevenue, 6))}
              </p>
              <p className="text-xs text-muted-foreground">Calculated: deposited - distributed (USDT)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collateral Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-amber-500" />
            Collateral Status
          </CardTitle>
          <CardDescription>Collateral deposit status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Collateral Amount</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(formatTokenAmount(vaultStatus.totalCollateral, 6))}
              </p>
              <p className="text-xs text-muted-foreground font-mono">totalCollateralAmount</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Liquidatable Collateral Amount</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(formatTokenAmount(vaultStatus.liquidatableCollateral, 6))}
              </p>
              <p className="text-xs text-muted-foreground font-mono">liquidatableCollateralAmount</p>
            </div>
          </div>
          
          {vaultStatus.liquidatableCollateral > 0n && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-900">Liquidation Alert</p>
                <p className="text-red-700 mt-1">
                  There is {formatCurrency(formatTokenAmount(vaultStatus.liquidatableCollateral, 6))} available for liquidation.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-emerald-500" />
            Vault Health Metrics
          </CardTitle>
          <CardDescription>Financial health indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fundraise Utilization</p>
              <p className="text-2xl font-bold">
                {vaultStatus.totalFundraised > 0n
                  ? ((Number(vaultStatus.withdrawnFundraise) / Number(vaultStatus.totalFundraised)) * 100).toFixed(2)
                  : '0.00'}%
              </p>
              <p className="text-xs text-muted-foreground">Capital usage rate</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Revenue Distribution Rate</p>
              <p className="text-2xl font-bold">
                {vaultStatus.depositedRevenue > 0n
                  ? ((Number(vaultStatus.distributedRevenue) / Number(vaultStatus.depositedRevenue)) * 100).toFixed(2)
                  : '0.00'}%
              </p>
              <p className="text-xs text-muted-foreground">Distribution efficiency</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Liquidation Risk</p>
              <p className="text-2xl font-bold">
                {vaultStatus.totalCollateral > 0n
                  ? ((Number(vaultStatus.liquidatableCollateral) / Number(vaultStatus.totalCollateral)) * 100).toFixed(2)
                  : '0.00'}%
              </p>
              <p className="text-xs text-muted-foreground">Risk percentage</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

