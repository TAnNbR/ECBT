'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CONTRACTS } from '@/config/contracts'
import { Copy, ExternalLink, FileCode } from 'lucide-react'
import { toast } from 'sonner'

const CONTRACT_INFO = [
  {
    name: 'AssetToken',
    address: CONTRACTS.AssetToken,
    description: 'Main asset token contract',
    color: 'text-blue-600',
  },
  {
    name: 'CollateralVault',
    address: CONTRACTS.CollateralVault,
    description: 'Manages collateral and revenue',
    color: 'text-green-600',
  },
  {
    name: 'RevenueManager',
    address: CONTRACTS.RevenueManager,
    description: 'Tracks and distributes revenue',
    color: 'text-purple-600',
  },
  {
    name: 'OrderBook',
    address: CONTRACTS.OrderBook,
    description: 'Manages buy/sell orders',
    color: 'text-orange-600',
  },
  {
    name: 'LiquidateManager',
    address: CONTRACTS.LiquidateManager,
    description: 'Handles liquidation logic',
    color: 'text-red-600',
  },
  {
    name: 'PaymentToken (USDT)',
    address: CONTRACTS.PaymentToken,
    description: 'ERC20 payment token',
    color: 'text-teal-600',
  },
]

export function ContractAddresses() {
  const copyAddress = (address: string, name: string) => {
    navigator.clipboard.writeText(address)
    toast.success(`${name} address copied!`)
  }

  const openEtherscan = (address: string) => {
    // Detect network from contract address or config
    const etherscanUrl = `https://sepolia.etherscan.io/address/${address}`
    window.open(etherscanUrl, '_blank')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="h-5 w-5" />
          Deployed Contracts
        </CardTitle>
        <CardDescription>
          All smart contract addresses on Sepolia testnet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {CONTRACT_INFO.map((contract) => (
            <div
              key={contract.name}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`font-semibold ${contract.color}`}>
                    {contract.name}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {contract.description}
                </p>
                <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
                  {contract.address}
                </p>
              </div>

              <div className="flex gap-1 ml-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyAddress(contract.address, contract.name)}
                  className="h-8 w-8 p-0"
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEtherscan(contract.address)}
                  className="h-8 w-8 p-0"
                  title="View on Etherscan"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Network Info */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-medium">Sepolia Testnet</span>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            All contracts are deployed on Ethereum Sepolia testnet. You can verify them on{' '}
            <a
              href="https://sepolia.etherscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-900"
            >
              Sepolia Etherscan
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

