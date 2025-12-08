'use client'

import { Header } from '@/components/Header'
import { AssetOverview } from '@/components/AssetOverview'
import { RevenueInfo } from '@/components/RevenueInfo'
import { PurchaseModal } from '@/components/PurchaseModal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Shield, Zap, Globe } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
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

      {/* Footer */}
      <footer className="border-t">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© 2024 ECBT Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

