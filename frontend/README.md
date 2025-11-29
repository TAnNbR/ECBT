# ECBT Platform Frontend

A modern, professional frontend for the ECBT (Enterprise Collateralized Bond Token) Real World Asset tokenization platform.

## 🚀 Features

- **Asset Token Purchase**: Buy RWA tokens with payment tokens (USDT)
- **Portfolio Management**: View your holdings, dividends, and liquidation claims
- **Order Book Trading**: Create sell orders and buy from other holders
- **Dividend Tracking**: Monitor and claim your revenue share
- **Real-time Updates**: Live blockchain data with automatic refresh
- **Wallet Integration**: Connect with MetaMask, WalletConnect, and more
- **Responsive Design**: Works seamlessly on desktop and mobile

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Web3**: Wagmi v2 + Viem
- **Wallet**: RainbowKit
- **UI**: TailwindCSS + shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp env.example .env.local

# Update .env.local with your contract addresses and RPC URL
```

## 🔧 Configuration

Edit `.env.local` with your deployed contract addresses:

```env
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545

# Contract Addresses
NEXT_PUBLIC_ASSET_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=0x...
NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_LIQUIDATE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_ORDER_BOOK_ADDRESS=0x...
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=0x...

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

Get a WalletConnect Project ID from: https://cloud.walletconnect.com

## 🚀 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run type-check

# Lint
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Home page
│   │   ├── layout.tsx    # Root layout
│   │   ├── providers.tsx # Web3 providers
│   │   └── globals.css   # Global styles
│   ├── components/       # React components
│   │   ├── ui/           # Base UI components (shadcn)
│   │   ├── Header.tsx    # Navigation header
│   │   ├── AssetOverview.tsx
│   │   └── PurchaseModal.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useAssetToken.ts
│   │   ├── useOrderBook.ts
│   │   └── useERC20.ts
│   ├── abi/              # Contract ABIs
│   │   ├── AssetToken.ts
│   │   ├── OrderBook.ts
│   │   └── ERC20.ts
│   ├── config/           # Configuration
│   │   ├── contracts.ts  # Contract addresses
│   │   └── wagmi.ts      # Wagmi configuration
│   └── lib/              # Utility functions
│       └── utils.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 🎨 Key Components

### Asset Token Purchase
Users can purchase asset tokens by:
1. Connecting their wallet
2. Approving payment token (USDT)
3. Entering purchase amount
4. Confirming transaction

### Order Book Trading
- **Create Sell Order**: List tokens for sale at your desired price
- **Buy from Orders**: Purchase tokens from active sell orders
- **Cancel Orders**: Remove your active sell orders

### Dividend Management
- View accumulated dividends
- Claim dividends to your wallet
- Track dividend history

## 🔐 Security Best Practices

- Always verify contract addresses before transactions
- Start with small test transactions
- Never share your private keys
- Use hardware wallets for large amounts
- Verify transaction details before signing

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Manual Deployment

```bash
# Build the app
npm run build

# Start production server
npm start
```

## 📱 Wallet Support

- MetaMask
- WalletConnect
- Coinbase Wallet
- Rainbow Wallet
- And many more via RainbowKit

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Open a GitHub issue
- Check existing documentation
- Contact the development team

## 🎯 Roadmap

- [ ] Advanced analytics dashboard
- [ ] Multi-asset support
- [ ] Mobile app
- [ ] Governance features
- [ ] Advanced trading features
- [ ] Multi-language support

---

Built with ❤️ using Next.js and Web3 technologies

