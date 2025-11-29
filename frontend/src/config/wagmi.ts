'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { localhost, mainnet, sepolia } from 'wagmi/chains'

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export const config = getDefaultConfig({
  appName: 'ECBT Platform',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [localhost, sepolia, mainnet],
  ssr: true,
})

