# ECBT Platform Frontend - Deployment Guide

## Prerequisites

1. **Deploy Smart Contracts First**
   - Deploy all contracts to your target network
   - Note down all contract addresses
   - Verify contracts on block explorer

2. **Setup WalletConnect**
   - Go to https://cloud.walletconnect.com
   - Create a new project
   - Copy your Project ID

## Environment Setup

Create `.env.local` file:

```env
# Network Configuration
NEXT_PUBLIC_CHAIN_ID=1            # 1 for mainnet, 11155111 for Sepolia
NEXT_PUBLIC_RPC_URL=https://...   # Your RPC endpoint

# Contract Addresses (from deployment)
NEXT_PUBLIC_ASSET_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=0x...
NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_LIQUIDATE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_ORDER_BOOK_ADDRESS=0x...
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=0x...  # USDT or other payment token

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Optional: Analytics
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

## Deployment Options

### Option 1: Vercel (Recommended)

1. **Connect Repository**
   ```bash
   # Push to GitHub
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to https://vercel.com
   - Import your repository
   - Add environment variables
   - Deploy

3. **Configure Domain**
   - Add custom domain in Vercel settings
   - Update DNS records

### Option 2: Docker

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine AS base

   # Install dependencies
   FROM base AS deps
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci

   # Build
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   # Production
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production
   
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs

   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

   USER nextjs
   EXPOSE 3000
   ENV PORT 3000

   CMD ["node", "server.js"]
   ```

2. **Build and Run**
   ```bash
   docker build -t ecbt-frontend .
   docker run -p 3000:3000 ecbt-frontend
   ```

### Option 3: Traditional Server

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Setup Process Manager**
   ```bash
   # Install PM2
   npm install -g pm2

   # Start application
   pm2 start npm --name "ecbt-frontend" -- start

   # Save configuration
   pm2 save
   pm2 startup
   ```

3. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Setup SSL with Let's Encrypt**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## Post-Deployment Checklist

### 1. Verify Contract Connections
- [ ] Can connect wallet
- [ ] Can read asset metadata
- [ ] Can view balances
- [ ] Can see orders

### 2. Test Core Functions
- [ ] Purchase tokens
- [ ] Approve payment token
- [ ] View portfolio
- [ ] Create sell order
- [ ] Buy from order book
- [ ] Claim dividends
- [ ] Cancel order

### 3. Security Checks
- [ ] Environment variables secure
- [ ] HTTPS enabled
- [ ] CSP headers configured
- [ ] Rate limiting enabled
- [ ] Error logging setup

### 4. Performance
- [ ] Lighthouse score > 90
- [ ] Images optimized
- [ ] Caching configured
- [ ] CDN setup (if needed)

### 5. Monitoring
- [ ] Error tracking (Sentry)
- [ ] Analytics (Google Analytics/Plausible)
- [ ] Uptime monitoring
- [ ] Transaction monitoring

## Network-Specific Configuration

### Mainnet Deployment
```env
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY
```

### Sepolia Testnet
```env
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
```

### Polygon
```env
NEXT_PUBLIC_CHAIN_ID=137
NEXT_PUBLIC_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR-KEY
```

### Arbitrum
```env
NEXT_PUBLIC_CHAIN_ID=42161
NEXT_PUBLIC_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR-KEY
```

## Troubleshooting

### Common Issues

1. **Wallet Connection Fails**
   - Check WalletConnect Project ID
   - Verify network configuration
   - Clear browser cache

2. **Contract Read Errors**
   - Verify contract addresses
   - Check RPC endpoint
   - Ensure contracts deployed

3. **Transaction Failures**
   - Check gas settings
   - Verify allowances
   - Check contract state

4. **Build Errors**
   - Clear `.next` folder
   - Delete `node_modules`
   - Run `npm install` again

## Maintenance

### Regular Updates
```bash
# Update dependencies
npm update

# Security audit
npm audit fix

# Rebuild
npm run build
```

### Monitoring Logs
```bash
# PM2 logs
pm2 logs ecbt-frontend

# Vercel logs
vercel logs
```

## Support

For deployment issues:
- Check documentation
- Review error logs
- Contact development team

---

Last updated: 2024

