'use client'

import { Header } from '@/components/Header'
import { AssetOverview } from '@/components/AssetOverview'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAccount } from 'wagmi'
import { useAssetTokenBalance, useFrozenAmount } from '@/hooks/useAssetToken'
import { formatTokenAmount } from '@/lib/utils'
import { Wallet, Lock, TrendingUp, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useAssetTokenBalance(address)
  const { data: frozenAmount } = useFrozenAmount(address)

  if (!isConnected) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container py-24">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to view your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button size="lg">Connect Wallet</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const availableBalance = balance && frozenAmount
    ? balance - frozenAmount
    : balance || 0n

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container py-8">
        <div className="space-y-2 mb-8">
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your investments and activities
          </p>
        </div>

        {/* User Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {balance ? formatTokenAmount(balance) : '0'}
              </div>
              <p className="text-xs text-muted-foreground">Asset tokens</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatTokenAmount(availableBalance)}
              </div>
              <p className="text-xs text-muted-foreground">Can sell or transfer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Orders</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {frozenAmount ? formatTokenAmount(frozenAmount) : '0'}
              </div>
              <p className="text-xs text-muted-foreground">Locked in sell orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Asset Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Asset Overview</h2>
          <AssetOverview />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Trade on Market</CardTitle>
              <CardDescription>
                Buy or sell asset tokens on the order book
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/market">
                  Go to Market
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>View Portfolio</CardTitle>
              <CardDescription>
                Check your holdings, dividends, and transaction history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/portfolio">
                  View Portfolio
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest transactions and events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No recent activity
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

