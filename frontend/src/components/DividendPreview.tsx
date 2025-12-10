'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMyDividend } from '@/hooks/useDividendQuote'
import { formatTokenAmount, formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DividendPreview() {
  const { dividendAmount, isLoading, error, refetch } = useMyDividend()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Claimable Dividend
            </CardTitle>
            <CardDescription>Your estimated dividend amount (6 decimals)</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">Calculating dividend...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-orange-900">Cannot calculate dividend</p>
                <p className="text-orange-700 mt-1">
                  {error.message || 'Please make sure tokens are sold out and you hold shares'}
                </p>
              </div>
            </div>
          </div>
        ) : dividendAmount > 0n ? (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="text-4xl font-bold text-green-600">
                {formatCurrency(formatTokenAmount(dividendAmount, 6))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">USDT (6 decimals)</p>
            </div>
            
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-900">Ready to claim!</p>
                  <p className="text-green-700 mt-1">
                    You can withdraw this dividend amount now. Note: This is an estimate using staticcall.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>🔍 <strong>How it works:</strong></p>
              <p className="ml-4">This uses the Uniswap V3 quoter pattern - calling withdrawDividend via staticcall (eth_call)</p>
              <p className="ml-4">✅ Zero gas cost (read-only query)</p>
              <p className="ml-4">✅ No state changes</p>
              <p className="ml-4">✅ Same logic as actual withdrawal</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg font-medium">No dividend available</p>
            <p className="text-sm mt-2">Either tokens are not sold out yet or no new revenue has been recorded</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

