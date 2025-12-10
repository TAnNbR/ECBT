'use client'

import { Header } from '@/components/Header'
import { AssetOverview } from '@/components/AssetOverview'
import { RevenueInfo } from '@/components/RevenueInfo'
import { PurchaseModal } from '@/components/PurchaseModal'
import { ContractAddresses } from '@/components/ContractAddresses'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCollateralVaultStatus } from '@/hooks/useCollateralVault'
import { formatTokenAmount, formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Shield, Zap, Globe, Vault, DollarSign, Coins, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const vaultStatus = useCollateralVaultStatus()
  
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="container py-12 md:py-24">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Invest in Real-World Assets
            <span className="block text-primary">Through Blockchain</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            ECBT Platform enables fractional ownership of premium real-world assets.
            Earn dividends, trade on-chain, and access institutional-grade investments.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <PurchaseModal />
            <Button size="lg" variant="outline" asChild>
              <Link href="/market">
                Explore Market
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Asset Overview */}
      <section className="container py-12">
        <h2 className="text-3xl font-bold mb-8">Current Asset</h2>
        <AssetOverview />
      </section>

      {/* Revenue Information */}
      <section className="container py-12 bg-muted/50">
        <RevenueInfo />
      </section>

      {/* Collateral Vault Stats - All 7 Variables */}
      <section className="container py-12">
        <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <Vault className="h-8 w-8" />
          Collateral Vault Status
        </h2>
        
        {/* Row 1: Fundraise (3 variables) */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Fundraise Metrics</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Fundraised Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.totalFundraised, 6))}
                </div>
                <p className="text-xs text-muted-foreground">totalFundraisedAmount</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Withdrawn Fundraise</CardTitle>
                <TrendingDown className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.withdrawnFundraise, 6))}
                </div>
                <p className="text-xs text-muted-foreground">totalWithdrawnFundraise</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Fundraise</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.availableFundraise, 6))}
                </div>
                <p className="text-xs text-muted-foreground">Calculated: fundraised - withdrawn</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Row 2: Revenue (3 variables) */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Revenue Metrics</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.currentRevenue, 18))}
                </div>
                <p className="text-xs text-muted-foreground">currentRevenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deposited Revenue</CardTitle>
                <Coins className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.depositedRevenue, 6))}
                </div>
                <p className="text-xs text-muted-foreground">depositedRevenue (USDT)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Distributed Revenue</CardTitle>
                <TrendingDown className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.distributedRevenue, 6))}
                </div>
                <p className="text-xs text-muted-foreground">distributedRevenue (USDT)</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Row 3: Collateral (2 variables) */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Collateral Metrics</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collateral Amount</CardTitle>
                <Shield className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.totalCollateral, 6))}
                </div>
                <p className="text-xs text-muted-foreground">totalCollateralAmount</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Liquidatable Collateral Amount</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(formatTokenAmount(vaultStatus.liquidatableCollateral, 6))}
                </div>
                <p className="text-xs text-muted-foreground">liquidatableCollateralAmount</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-12">
        <h2 className="text-3xl font-bold mb-8 text-center">Why Choose ECBT?</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Passive Income</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Earn regular dividends from real asset revenue. Track your earnings in real-time.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Secure & Transparent</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                All transactions on-chain. Smart contracts audited and battle-tested.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Instant Liquidity</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Trade your tokens anytime on our order book. No lock-up periods.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Globe className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Global Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Invest from anywhere in the world. Fractional ownership made simple.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-12 md:py-24">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Ready to Get Started?</CardTitle>
            <CardDescription className="text-primary-foreground/80 text-lg">
              Connect your wallet and start investing in real-world assets today.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PurchaseModal />
          </CardContent>
        </Card>
      </section>

      {/* Contract Addresses */}
      <section className="container py-12">
        <ContractAddresses />
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© 2024 ECBT Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

