'use client'

import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrder, useNextOrderId, OrderStatus } from '@/hooks/useOrderBook'
import { formatTokenAmount, formatCurrency, formatDateTime, shortenAddress } from '@/lib/utils'
import { useState } from 'react'
import { ShoppingCart, TrendingUp, Clock, User } from 'lucide-react'

export default function MarketPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<bigint>(1n)
  const { data: nextOrderId } = useNextOrderId()
  const { data: orderData } = useOrder(selectedOrderId)

  // 模拟订单列表（实际应该从链上批量获取）
  const mockOrders = [
    {
      orderId: 1n,
      seller: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: 1000n * 10n**18n,
      price: 10n * 10n**18n,
      filledAmount: 0n,
      status: OrderStatus.Active,
    },
    {
      orderId: 2n,
      seller: '0x1234567890123456789012345678901234567890',
      amount: 500n * 10n**18n,
      price: 12n * 10n**18n,
      filledAmount: 100n * 10n**18n,
      status: OrderStatus.Active,
    },
  ]

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container py-8">
        <div className="space-y-2 mb-8">
          <h1 className="text-4xl font-bold">Market</h1>
          <p className="text-muted-foreground">
            Browse and trade asset tokens on the order book
          </p>
        </div>

        <Tabs defaultValue="buy" className="space-y-6">
          <TabsList>
            <TabsTrigger value="buy">Buy Orders</TabsTrigger>
            <TabsTrigger value="sell">My Sell Orders</TabsTrigger>
            <TabsTrigger value="history">Trade History</TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Sell Orders</CardTitle>
                <CardDescription>
                  Purchase asset tokens from other holders at their listed price
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOrders.map((order) => (
                    <div
                      key={order.orderId.toString()}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            Order #{order.orderId.toString()}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {shortenAddress(order.seller)}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Coins className="h-3 w-3" />
                            Amount: {formatTokenAmount(order.amount)}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Price: ${formatTokenAmount(order.price, 6)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {formatCurrency(
                              Number(formatTokenAmount(order.amount)) *
                                Number(formatTokenAmount(order.price, 6))
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Value
                          </div>
                        </div>
                        <Button>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Buy
                        </Button>
                      </div>
                    </div>
                  ))}

                  {mockOrders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No active orders available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sell">
            <Card>
              <CardHeader>
                <CardTitle>Your Sell Orders</CardTitle>
                <CardDescription>
                  Manage your active sell orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Connect your wallet to view your orders
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Trade History</CardTitle>
                <CardDescription>
                  Recent trades on the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No trade history available
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function Coins({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  )
}

