import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY || ''
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.ethers.io'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, amount = '100000' } = body

    // 验证地址
    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid address' },
        { status: 400 }
      )
    }

    // 验证金额
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a positive number' },
        { status: 400 }
      )
    }

    // 可选：设置最大金额限制（防止滥用）
    const MAX_AMOUNT = 10000000000 // 100亿 USDT
    if (amountNum > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `Amount too large. Maximum: ${MAX_AMOUNT.toLocaleString()} USDT` },
        { status: 400 }
      )
    }

    // 检查是否配置了私钥
    if (!FAUCET_PRIVATE_KEY || FAUCET_PRIVATE_KEY === '') {
      return NextResponse.json(
        { 
          error: 'Faucet not configured. Please contact administrator.',
          hint: 'Set FAUCET_PRIVATE_KEY in .env.local' 
        },
        { status: 503 }
      )
    }

    // 读取部署信息
    const fs = require('fs')
    const path = require('path')
    const deploymentPath = path.join(process.cwd(), '../deployment-info-sepolia.json')
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
    const paymentTokenAddress = deploymentInfo.contracts.MockERC20

    // 连接到区块链
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider)

    // 获取合约实例
    const MockERC20ABI = [
      'function mint(address to, uint256 amount) external returns (bool)',
      'function balanceOf(address account) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ]
    
    const paymentToken = new ethers.Contract(paymentTokenAddress, MockERC20ABI, wallet)

    // 铸造代币
    const mintAmount = ethers.parseUnits(amount, 6)
    console.log(`Minting ${amount} USDT to ${address}`)
    
    const tx = await paymentToken.mint(address, mintAmount)
    console.log('Transaction sent:', tx.hash)
    
    await tx.wait()
    console.log('Transaction confirmed')

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      amount: amount,
      recipient: address,
      explorerUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`,
    })

  } catch (error: any) {
    console.error('Faucet error:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process faucet request',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    network: 'Sepolia',
    restrictions: 'No time limit, any amount up to 10B USDT',
    maxAmount: '10,000,000,000 USDT',
  })
}

