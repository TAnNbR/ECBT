'use client'

import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAccount } from 'wagmi'
import { useNextOrderId, useUserOrders } from '@/hooks/useOrderBook'
import { OrderItem } from '@/components/OrdersList'
import { SellOrderDialog } from '@/components/SellOrderDialog'
import { useAssetTokenBalance, useFrozenAmount } from '@/hooks/useAssetToken'

export default function MarketPage() {
  const { address } = useAccount()
  const { data: nextOrderId } = useNextOrderId()
  const { data: userOrderIds, isLoading: isLoadingOrders } = useUserOrders(address)
  const { data: balance } = useAssetTokenBalance(address)
  const { data: frozenAmount } = useFrozenAmount(address)
  
  const availableBalance = balance && frozenAmount ? balance - frozenAmount : balance || 0n

  // Debug logging
  console.log('Market Page Debug:')
  console.log('- Address:', address)
  console.log('- User Order IDs:', userOrderIds)
  console.log('- Is Loading Orders:', isLoadingOrders)
  console.log('- User Orders is Array:', Array.isArray(userOrderIds))
  console.log('- User Orders length:', userOrderIds ? (Array.isArray(userOrderIds) ? userOrderIds.length : 'not array') : 'undefined')

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
                    No active orders available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sell">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Sell Orders</CardTitle>
                    <CardDescription>
                      Manage your active sell orders
                    </CardDescription>
                  </div>
                  {address && <SellOrderDialog availableBalance={availableBalance} />}
                </div>
              </CardHeader>
              <CardContent>
                {!address ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Connect your wallet to view your orders
                  </div>
                ) : isLoadingOrders ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading your orders...
                  </div>
                ) : !userOrderIds || (Array.isArray(userOrderIds) && userOrderIds.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No sell orders found. Create your first order above.</p>
                    <p className="text-xs mt-2">Debug: userOrderIds = {JSON.stringify(userOrderIds)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Found {Array.isArray(userOrderIds) ? userOrderIds.length : 0} order(s)
                    </p>
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

