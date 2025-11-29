'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { Building2 } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Building2 className="h-6 w-6" />
          <span className="text-xl font-bold">ECBT Platform</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">
            Dashboard
          </Link>
          <Link href="/market" className="text-sm font-medium transition-colors hover:text-primary">
            Market
          </Link>
          <Link href="/portfolio" className="text-sm font-medium transition-colors hover:text-primary">
            Portfolio
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  )
}

