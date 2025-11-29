import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  OrderCreated as OrderCreatedEvent,
  OrderFilled as OrderFilledEvent,
  OrderCancelled as OrderCancelledEvent
} from "../generated/OrderBook/OrderBook"
import {
  Order,
  OrderFill,
  OrderCancellation,
  User,
  GlobalStats
} from "../generated/schema"

// 辅助函数：获取或创建用户
function getOrCreateUser(address: Bytes): User {
  let user = User.load(address.toHexString())
  if (user == null) {
    user = new User(address.toHexString())
    user.address = address
    user.totalOrdersCreated = BigInt.fromI32(0)
    user.totalOrdersFilled = BigInt.fromI32(0)
    user.totalOrdersCancelled = BigInt.fromI32(0)
    user.totalVolumeAssSeller = BigInt.fromI32(0)
    user.totalVolumeAsBuyer = BigInt.fromI32(0)
    user.save()

    // 更新全局统计
    let stats = getOrCreateGlobalStats()
    stats.uniqueUsers = stats.uniqueUsers.plus(BigInt.fromI32(1))
    stats.save()
  }
  return user as User
}

// 辅助函数：获取或创建全局统计
function getOrCreateGlobalStats(): GlobalStats {
  let stats = GlobalStats.load("global")
  if (stats == null) {
    stats = new GlobalStats("global")
    stats.totalOrders = BigInt.fromI32(0)
    stats.totalActiveOrders = BigInt.fromI32(0)
    stats.totalFilledOrders = BigInt.fromI32(0)
    stats.totalCancelledOrders = BigInt.fromI32(0)
    stats.totalVolume = BigInt.fromI32(0)
    stats.totalFills = BigInt.fromI32(0)
    stats.uniqueUsers = BigInt.fromI32(0)
    stats.lastUpdateTimestamp = BigInt.fromI32(0)
    stats.lastUpdateBlock = BigInt.fromI32(0)
  }
  return stats as GlobalStats
}

// 处理订单创建事件
export function handleOrderCreated(event: OrderCreatedEvent): void {
  // 更新卖家统计
  let seller = getOrCreateUser(event.params.seller)
  seller.totalOrdersCreated = seller.totalOrdersCreated.plus(BigInt.fromI32(1))
  seller.save()

  // 创建订单实体
  let order = new Order(event.params.orderId.toString())
  order.orderId = event.params.orderId
  order.seller = seller.id
  order.sellerAddress = event.params.seller
  order.amount = event.params.amount
  order.price = event.params.price
  order.filledAmount = BigInt.fromI32(0)
  order.remainingAmount = event.params.amount
  order.status = "Active"
  order.totalPaymentReceived = BigInt.fromI32(0)
  order.createdAt = event.block.timestamp
  order.createdAtBlock = event.block.number
  order.updatedAt = event.block.timestamp
  order.updatedAtBlock = event.block.number
  order.save()

  // 更新全局统计
  let stats = getOrCreateGlobalStats()
  stats.totalOrders = stats.totalOrders.plus(BigInt.fromI32(1))
  stats.totalActiveOrders = stats.totalActiveOrders.plus(BigInt.fromI32(1))
  stats.lastUpdateTimestamp = event.block.timestamp
  stats.lastUpdateBlock = event.block.number
  stats.save()
}

// 处理订单成交事件
export function handleOrderFilled(event: OrderFilledEvent): void {
  // 加载订单
  let order = Order.load(event.params.orderId.toString())
  if (order == null) {
    return
  }

  // 更新买家统计
  let buyer = getOrCreateUser(event.params.buyer)
  buyer.totalVolumeAsBuyer = buyer.totalVolumeAsBuyer.plus(event.params.filledAmount)
  buyer.save()

  // 创建成交记录
  let fillId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let fill = new OrderFill(fillId)
  fill.order = order.id
  fill.orderId = event.params.orderId
  fill.buyer = buyer.id
  fill.buyerAddress = event.params.buyer
  fill.filledAmount = event.params.filledAmount
  fill.remainingAmount = event.params.remainingAmount
  fill.totalPayment = event.params.totalPayment
  fill.timestamp = event.block.timestamp
  fill.blockNumber = event.block.number
  fill.transactionHash = event.transaction.hash
  fill.save()

  // 更新订单状态
  let wasActive = order.status == "Active"
  order.filledAmount = order.filledAmount.plus(event.params.filledAmount)
  order.remainingAmount = event.params.remainingAmount
  order.totalPaymentReceived = order.totalPaymentReceived.plus(event.params.totalPayment)
  order.updatedAt = event.block.timestamp
  order.updatedAtBlock = event.block.number
  
  // 如果订单完全成交
  if (event.params.remainingAmount.equals(BigInt.fromI32(0))) {
    order.status = "Filled"
  }
  order.save()

  // 更新卖家统计
  let seller = User.load(order.seller)
  if (seller != null) {
    seller.totalVolumeAssSeller = seller.totalVolumeAssSeller.plus(event.params.filledAmount)
    if (order.status == "Filled") {
      seller.totalOrdersFilled = seller.totalOrdersFilled.plus(BigInt.fromI32(1))
    }
    seller.save()
  }

  // 更新全局统计
  let stats = getOrCreateGlobalStats()
  stats.totalVolume = stats.totalVolume.plus(event.params.filledAmount)
  stats.totalFills = stats.totalFills.plus(BigInt.fromI32(1))
  
  // 如果订单完全成交，更新订单状态统计
  if (order.status == "Filled" && wasActive) {
    stats.totalActiveOrders = stats.totalActiveOrders.minus(BigInt.fromI32(1))
    stats.totalFilledOrders = stats.totalFilledOrders.plus(BigInt.fromI32(1))
  }
  
  stats.lastUpdateTimestamp = event.block.timestamp
  stats.lastUpdateBlock = event.block.number
  stats.save()
}

// 处理订单取消事件
export function handleOrderCancelled(event: OrderCancelledEvent): void {
  // 加载订单
  let order = Order.load(event.params.orderId.toString())
  if (order == null) {
    return
  }

  // 创建取消记录
  let cancellation = new OrderCancellation(event.params.orderId.toString())
  cancellation.order = order.id
  cancellation.orderId = event.params.orderId
  cancellation.refundedAmount = event.params.refundedAmount
  cancellation.timestamp = event.block.timestamp
  cancellation.blockNumber = event.block.number
  cancellation.transactionHash = event.transaction.hash
  cancellation.save()

  // 更新订单状态
  let wasActive = order.status == "Active"
  order.status = "Cancelled"
  order.updatedAt = event.block.timestamp
  order.updatedAtBlock = event.block.number
  order.save()

  // 更新卖家统计
  let seller = User.load(order.seller)
  if (seller != null) {
    seller.totalOrdersCancelled = seller.totalOrdersCancelled.plus(BigInt.fromI32(1))
    seller.save()
  }

  // 更新全局统计
  let stats = getOrCreateGlobalStats()
  if (wasActive) {
    stats.totalActiveOrders = stats.totalActiveOrders.minus(BigInt.fromI32(1))
    stats.totalCancelledOrders = stats.totalCancelledOrders.plus(BigInt.fromI32(1))
  }
  stats.lastUpdateTimestamp = event.block.timestamp
  stats.lastUpdateBlock = event.block.number
  stats.save()
}

