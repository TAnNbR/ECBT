'use client'

import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAccount } from 'wagmi'
import { useAssetTokenBalance, useFrozenAmount, useWithdrawDividend } from '@/hooks/useAssetToken'
import { useERC20Balance } from '@/hooks/useERC20'
import { useUserOrders, useNextOrderId } from '@/hooks/useOrderBook'
import { SellOrderDialog } from '@/components/SellOrderDialog'
import { OrderItem } from '@/components/OrdersList'
import { DividendPreview } from '@/components/DividendPreview'
import { CONTRACTS } from '@/config/contracts'
import { formatTokenAmount, formatCurrency, formatDateTime } from '@/lib/utils'
import { Wallet, Gift, History, TrendingUp, Loader2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useAssetTokenBalance(address)
  const { data: frozenAmount } = useFrozenAmount(address)
  const { data: usdtBalance } = useERC20Balance(CONTRACTS.PaymentToken, address)
  const { withdraw, isPending, error, errorMessage, hash, isSuccess } = useWithdrawDividend()
  
  // 订单相关
  const { data: userOrderIds } = useUserOrders(address)
  const { data: nextOrderId } = useNextOrderId()
  
  const availableBalance = balance && frozenAmount ? balance - frozenAmount : balance || 0n

  const handleWithdrawDividend = async () => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      toast.info('Sending transaction...')
      await withdraw(address, address)
      
      // 等待一下让 wagmi 处理
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (hash) {
        toast.success('Transaction sent! Waiting for confirmation...', {
          description: `Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`
        })
      }
    } catch (error: any) {
      console.error('Withdraw error:', error)
      
      // 显示友好的错误消息
      const message = error?.message || ''
      
      if (message.includes('dropped') || message.includes('replaced')) {
        toast.error('交易被替换或丢弃', {
          description: '请重新尝试提取分红'
        })
      } else if (message.includes('Token not sold out yet')) {
        toast.error('代币尚未售罄', {
          description: '需要等待售罄后 1 天才能提取分红'
        })
      } else if (message.includes('Insufficient available revenue')) {
        toast.error('可用收益不足', {
          description: '请联系管理员检查 CollateralVault'
        })
      } else if (message.includes('timeout')) {
        toast.error('交易确认超时', {
          description: '请在区块浏览器查看交易状态'
        })
      } else if (message.includes('user rejected')) {
        toast.info('已取消交易')
      } else if (message.includes('gas')) {
        toast.error('Gas 估算失败', {
          description: errorMessage || '请检查合约状态或稍后重试'
        })
      } else {
        toast.error('提取分红失败', {
          description: errorMessage || message.slice(0, 100)
        })
      }
    }
  }

  // 监听交易成功
  if (isSuccess && hash) {
    toast.success('Dividend withdrawn successfully!', {
      description: 'Transaction confirmed on blockchain'
    })
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
              <CardTitle className="text-sm font-medium">USDT Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usdtBalance ? formatCurrency(formatTokenAmount(usdtBalance, 6)) : '$0.00'}
              </div>
              <p className="text-xs text-muted-foreground">Payment token</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Asset Tokens</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {balance ? formatTokenAmount(balance) : '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                {frozenAmount && frozenAmount > 0n 
                  ? `${formatTokenAmount(frozenAmount)} frozen` 
                  : 'Total holdings'}
              </p>
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

        {/* Dividend Preview - Uniswap Quoter Pattern */}
        <div className="mb-8">
          <DividendPreview />
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
                    {isPending ? 'Processing...' : 'Claim All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 交易状态显示 */}
                  {hash && (
                    <div className="rounded-lg border p-4 bg-muted/50">
                      <p className="text-sm font-medium mb-2">
                        {isSuccess ? '✅ Transaction Confirmed' : '⏳ Transaction Pending'}
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-background px-2 py-1 rounded">
                          {hash.slice(0, 10)}...{hash.slice(-8)}
                        </code>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View on Etherscan →
                        </a>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center py-8 text-muted-foreground">
                    {balance && balance > 0n 
                      ? 'Click "Claim All" to withdraw your dividend earnings'
                      : 'No dividends available to claim'}
                  </div>
                  
                  {/* 错误提示 */}
                  {error && (
                    <div className="rounded-lg border border-destructive/50 p-4 bg-destructive/10">
                      <p className="text-sm font-medium text-destructive mb-1">
                        Transaction Failed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {errorMessage || 'Please try again'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-6">
              {/* 我的卖单 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>My Sell Orders</CardTitle>
                      <CardDescription>
                        Your active and completed sell orders
                      </CardDescription>
                    </div>
                    <SellOrderDialog availableBalance={availableBalance} />
                  </div>
                </CardHeader>
                <CardContent>
                  {!userOrderIds || (Array.isArray(userOrderIds) && userOrderIds.length === 0) ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No sell orders found. Create your first order above.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(Array.isArray(userOrderIds) ? userOrderIds : []).map((orderId: bigint) => (
                        <OrderItem
                          key={orderId.toString()}
                          orderId={orderId}
                          userAddress={address}
                          onCancelSuccess={() => window.location.reload()}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 市场订单（可购买） */}
              <Card>
                <CardHeader>
                  <CardTitle>Market Orders</CardTitle>
                  <CardDescription>
                    Available orders from other sellers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {nextOrderId && Number(nextOrderId) > 1 ? (
                    <div className="space-y-3">
                      {Array.from({ length: Math.min(Number(nextOrderId) - 1, 20) }, (_, i) => {
                        const orderId = BigInt(i + 1)
                        return (
                          <OrderItem
                            key={orderId.toString()}
                            orderId={orderId}
                            userAddress={address}
                            onCancelSuccess={() => window.location.reload()}
                          />
                        )
                      })}
                      {Number(nextOrderId) - 1 > 20 && (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          Showing first 20 orders. Total: {Number(nextOrderId) - 1} orders
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No market orders available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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

