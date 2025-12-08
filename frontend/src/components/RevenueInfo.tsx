'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentAccumulatedRevenue } from '@/hooks/useRevenueManager'
import { formatTokenAmount, formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, Calendar } from 'lucide-react'

export function RevenueInfo() {
  const { data: accumulatedRevenue, isLoading } = useCurrentAccumulatedRevenue()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Revenue Information...</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  const totalRevenue = accumulatedRevenue || 0n

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-4">Revenue Information</h2>
        <p className="text-muted-foreground">
          Total revenue generated from the asset
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(formatTokenAmount(totalRevenue, 6))}
            </div>
            <p className="text-xs text-muted-foreground">
              Accumulated revenue (USDT)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Status</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRevenue > 0n ? 'Active' : 'No Revenue'}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRevenue > 0n 
                ? 'Revenue has been recorded' 
                : 'Waiting for revenue distribution'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dividend Info</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRevenue > 0n ? 'Available' : 'Pending'}
            </div>
            <p className="text-xs text-muted-foreground">
              After sold out, holders can claim
            </p>
          </CardContent>
        </Card>
      </div>

      {totalRevenue > 0n && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg">💡 How to Claim Dividends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. ✅ Revenue has been recorded: {formatCurrency(formatTokenAmount(totalRevenue, 6))} USDT</p>
            <p>2. ⏳ Wait for token sale to complete (sold out)</p>
            <p>3. 💰 Claim your dividend share based on your holdings</p>
            <p className="text-muted-foreground pt-2">
              Note: Dividends are only claimable after the token sale is completed and the sold-out period has passed (1 day).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

