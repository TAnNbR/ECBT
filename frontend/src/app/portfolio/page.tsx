'use client'

import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAccount } from 'wagmi'
import { useAssetTokenBalance, useFrozenAmount, useWithdrawDividend } from '@/hooks/useAssetToken'
import { formatTokenAmount, formatCurrency, formatDateTime } from '@/lib/utils'
import { Wallet, Gift, History, TrendingUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useAssetTokenBalance(address)
  const { data: frozenAmount } = useFrozenAmount(address)
  const { withdraw, isPending } = useWithdrawDividend()

  const handleWithdrawDividend = async () => {
    if (!address) return

    try {
      toast.info('Withdrawing dividend...')
      await withdraw(address, address)
      toast.success('Dividend withdrawn successfully!')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to withdraw dividend')
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container py-24">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to view your portfolio
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

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container py-8">
        <div className="space-y-2 mb-8">
          <h1 className="text-4xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">
            Manage your holdings, dividends, and transaction history
          </p>
        </div>

        {/* Portfolio Summary */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Holdings</CardTitle>
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
              <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">Current value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Dividends</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">All time earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Dividends</CardTitle>
              <Gift className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">$0.00</div>
              <p className="text-xs text-muted-foreground">Available to claim</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="holdings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="holdings">Holdings</TabsTrigger>
            <TabsTrigger value="dividends">Dividends</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="holdings">
            <Card>
              <CardHeader>
                <CardTitle>Your Holdings</CardTitle>
                <CardDescription>
                  Breakdown of your asset token holdings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-semibold">Asset Token</div>
                      <div className="text-sm text-muted-foreground">
                        Available: {balance ? formatTokenAmount(balance - (frozenAmount || 0n)) : '0'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        In Orders: {frozenAmount ? formatTokenAmount(frozenAmount) : '0'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {balance ? formatTokenAmount(balance) : '0'}
                      </div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dividends">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Dividend Claims</CardTitle>
                    <CardDescription>
                      View and claim your dividend earnings
                    </CardDescription>
                  </div>
                  <Button onClick={handleWithdrawDividend} disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Claim All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No dividends available to claim
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Your Orders</CardTitle>
                <CardDescription>
                  Active and completed sell orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No orders found
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  All your transactions on the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No transaction history
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

