'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAssetTokenMetadata, useTotalSupply, useRemainingSupply } from '@/hooks/useAssetToken'
import { formatTokenAmount, formatCurrency, formatDate } from '@/lib/utils'
import { TrendingUp, Coins, Users, Calendar, Building2, Wallet, CheckCircle2, Clock } from 'lucide-react'
import { useSoldOutTimestamp } from '@/hooks/useAssetToken'

export function AssetOverview() {
  const { data: metadata } = useAssetTokenMetadata()
  const { data: totalSupply } = useTotalSupply()
  const { data: remainingSupply } = useRemainingSupply()
  const { data: soldOutTimestamp } = useSoldOutTimestamp()

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

  const isSoldOut = soldOutTimestamp && soldOutTimestamp > 0n

  return (
    <div className="space-y-6">
      {/* Asset Header */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl mb-2">{name}</CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {symbol}
                </Badge>
                {isSoldOut && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Sold Out
                  </Badge>
                )}
                {!isSoldOut && soldPercentage > 0 && (
                  <Badge variant="outline">
                    <Clock className="w-4 h-4 mr-1" />
                    Active Sale
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Asset Valuation</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(formatTokenAmount(totalValue, 6))}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fundraise Goal</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
              {formatCurrency(formatTokenAmount(fundraiseAmount, 6))}
          </div>
            <p className="text-xs text-muted-foreground">Target capital raised</p>
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
            {/* Progress Bar */}
            <div className="mt-2 w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min(soldPercentage, 100)}%` }}
              />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Supply</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
              {remainingSupply ? formatTokenAmount(remainingSupply) : '0'}
          </div>
            <p className="text-xs text-muted-foreground">Tokens remaining for purchase</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Launch Date</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDate(Number(createdAt))}</div>
            <p className="text-xs text-muted-foreground">Asset creation date</p>
          </CardContent>
        </Card>
      </div>

      {/* Entity Information */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Special Purpose Vehicle (SPV)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Legal Entity Address</p>
            <code className="text-xs bg-secondary px-2 py-1 rounded block overflow-x-auto">
              {spv}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              The legal entity that holds the real-world asset
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Asset Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Provider Wallet Address</p>
            <code className="text-xs bg-secondary px-2 py-1 rounded block overflow-x-auto">
              {provider}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              The entity providing and managing the asset
            </p>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

