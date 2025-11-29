'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAssetTokenMetadata, useTotalSupply, useRemainingSupply } from '@/hooks/useAssetToken'
import { formatTokenAmount, formatCurrency, formatDate } from '@/lib/utils'
import { TrendingUp, Coins, Users, Calendar } from 'lucide-react'

export function AssetOverview() {
  const { data: metadata } = useAssetTokenMetadata()
  const { data: totalSupply } = useTotalSupply()
  const { data: remainingSupply } = useRemainingSupply()

  if (!metadata) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Asset Information...</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  const [name, symbol, totalValue, fundraiseAmount, maxTotalSupply, spv, provider, createdAt] = metadata

  const soldPercentage = totalSupply && maxTotalSupply > 0n
    ? Number((maxTotalSupply - (remainingSupply || 0n)) * 100n / maxTotalSupply)
    : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(formatTokenAmount(totalValue, 6))}
          </div>
          <p className="text-xs text-muted-foreground">Asset valuation</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tokens Sold</CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{soldPercentage.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {totalSupply ? formatTokenAmount(totalSupply) : '0'} / {formatTokenAmount(maxTotalSupply)} tokens
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fundraise Goal</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(formatTokenAmount(fundraiseAmount, 6))}
          </div>
          <p className="text-xs text-muted-foreground">Target capital</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Launch Date</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDate(Number(createdAt))}</div>
          <p className="text-xs text-muted-foreground">{symbol}</p>
        </CardContent>
      </Card>
    </div>
  )
}

