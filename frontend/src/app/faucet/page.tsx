'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAccount } from 'wagmi'
import { useERC20Balance } from '@/hooks/useERC20'
import { CONTRACTS } from '@/config/contracts'
import { formatTokenAmount } from '@/lib/utils'
import { Droplets, Copy, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function FaucetPage() {
  const { address, isConnected } = useAccount()
  const { data: usdtBalance, refetch: refetchBalance } = useERC20Balance(CONTRACTS.PaymentToken, address)
  const [isRequesting, setIsRequesting] = useState(false)
  const [lastClaimTx, setLastClaimTx] = useState<string>('')
  const [claimAmount, setClaimAmount] = useState('100000')

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr)
    toast.success('Address copied!')
  }

  const requestTokens = async () => {
    if (!address) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!claimAmount || parseFloat(claimAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsRequesting(true)
    
    try {
      // 调用后端 API 来铸造代币
      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address,
          amount: claimAmount,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setLastClaimTx(data.txHash)
        toast.success('Tokens claimed successfully!', {
          description: `You received ${data.amount} USDT`
        })
        
        // 等待一下再刷新余额
        setTimeout(() => {
          refetchBalance()
        }, 3000)
      } else {
        throw new Error(data.error || 'Failed to claim tokens')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim tokens')
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Droplets className="h-12 w-12 text-blue-500" />
              <h1 className="text-4xl font-bold">USDT Faucet</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Get free test USDT on Sepolia testnet
            </p>
          </div>

          {!isConnected ? (
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Connect Your Wallet</CardTitle>
                <CardDescription>
                  Please connect your wallet to claim test tokens
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button size="lg">Connect Wallet</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* User Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Wallet</CardTitle>
                  <CardDescription>Current address and balance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground mb-1">Address</p>
                      <p className="font-mono text-sm truncate">{address}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyAddress(address!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">USDT Balance</p>
                    <p className="text-2xl font-bold">
                      {usdtBalance ? formatTokenAmount(usdtBalance, 6) : '0.00'} USDT
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Claim Tokens */}
              <Card>
                <CardHeader>
                  <CardTitle>Claim Test Tokens</CardTitle>
                  <CardDescription>
                    Enter any amount of USDT you need for testing on Sepolia
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border-2 border-dashed border-primary/50 p-6">
                    <Droplets className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="claimAmount" className="text-sm font-medium">
                          Amount (USDT)
                        </label>
                        <Input
                          id="claimAmount"
                          type="number"
                          placeholder="100000"
                          value={claimAmount}
                          onChange={(e) => setClaimAmount(e.target.value)}
                          disabled={isRequesting}
                          className="text-center text-2xl font-bold"
                        />
                        
                        {/* Quick amount buttons */}
                        <div className="grid grid-cols-4 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setClaimAmount('10000')}
                            disabled={isRequesting}
                          >
                            10K
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setClaimAmount('100000')}
                            disabled={isRequesting}
                          >
                            100K
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setClaimAmount('1000000')}
                            disabled={isRequesting}
                          >
                            1M
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setClaimAmount('10000000')}
                            disabled={isRequesting}
                          >
                            10M
                          </Button>
                        </div>
                        
                        <p className="text-xs text-muted-foreground text-center">
                          ✨ No limit, no cooldown - claim as much as you need!
                        </p>
                      </div>

                      <Button
                        size="lg"
                        onClick={requestTokens}
                        disabled={isRequesting || !claimAmount}
                        className="w-full"
                      >
                        {isRequesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRequesting ? 'Claiming...' : 'Claim Tokens'}
                      </Button>
                    </div>
                  </div>

                  {lastClaimTx && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-green-900">Tokens claimed!</p>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-xs font-mono text-green-700 truncate flex-1">
                              {lastClaimTx}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(`https://sepolia.etherscan.io/tx/${lastClaimTx}`, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle>How to Use</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Connect your wallet</p>
                      <p className="text-muted-foreground">Make sure you're on Sepolia testnet</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Enter amount and click &quot;Claim Tokens&quot;</p>
                      <p className="text-muted-foreground">Choose any amount or use quick buttons</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Start trading</p>
                      <p className="text-muted-foreground">Use your USDT to purchase asset tokens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contract Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Contract Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <div>
                      <p className="text-xs text-muted-foreground">USDT Contract</p>
                      <p className="font-mono text-xs">{CONTRACTS.PaymentToken}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyAddress(CONTRACTS.PaymentToken)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`https://sepolia.etherscan.io/token/${CONTRACTS.PaymentToken}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mt-4 space-y-1">
                    <p>• This is a test token on Sepolia testnet</p>
                    <p>• Tokens have no real value</p>
                    <p>• Use them to test the ECBT platform</p>
                    <p>• ✨ Unlimited claims - get as much as you need!</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

