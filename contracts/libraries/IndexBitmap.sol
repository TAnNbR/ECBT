// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IndexBitmap
 * @notice 使用位图高效存储和查询索引
 * @dev 每个 bit 代表一个索引位置
 * 使用方法：using IndexBitmap for mapping(uint256 => uint256);
 */
library IndexBitmap {
    // 每个 uint256 可以存储的位数
    uint256 internal constant BITS_PER_SLOT = 256;
    
    /**
     * @notice 设置某个索引的标记
     * @param bitmap 位图映射表
     * @param index 索引
     */
    function set(
        mapping(uint256 => uint256) storage bitmap,
        uint256 index
    ) internal {
        uint256 slotIndex = index / BITS_PER_SLOT;
        uint256 bitPosition = index % BITS_PER_SLOT;
        
        uint256 mask = 1 << bitPosition;
        bitmap[slotIndex] |= mask;
    }

    /**
     * @notice 查找范围内被标记的最小索引（第一个标记的索引）
     * @param bitmap 位图映射表
     * @param startIndex 起始索引（不包含）
     * @param endIndex 结束索引（包含）
     * @return found 是否找到
     * @return minIndex 最小索引（如果未找到则为0）
     */
    function findMinMarked(
        mapping(uint256 => uint256) storage bitmap,
        uint256 startIndex,
        uint256 endIndex
    ) internal view returns (
        bool found,
        uint256 minIndex
    ) {
        require(startIndex < endIndex, "Invalid range");
        
        // 搜索范围是 (startIndex, endIndex]，实际起始索引是 startIndex + 1
        uint256 actualStartIndex = startIndex + 1;
        uint256 startSlot = actualStartIndex / BITS_PER_SLOT;
        uint256 endSlot = endIndex / BITS_PER_SLOT;
        
        // 遍历所有可能包含标记的 slot
        for (uint256 slot = startSlot; slot <= endSlot; slot++) {
            uint256 slotValue = bitmap[slot];
            
            // 如果这个 slot 完全为空，跳过
            if (slotValue == 0) {
                continue;
            }
            
            // 计算在当前 slot 中的起始和结束位置
            uint256 bitStart = (slot == startSlot) ? (actualStartIndex % BITS_PER_SLOT) : 0;
            uint256 bitEnd = (slot == endSlot) ? (endIndex % BITS_PER_SLOT) : (BITS_PER_SLOT - 1);
            
            // 在当前 slot 中查找第一个被标记的位
            for (uint256 bitPos = bitStart; bitPos <= bitEnd; bitPos++) {
                if ((slotValue & (1 << bitPos)) != 0) {
                    return (true, slot * BITS_PER_SLOT + bitPos);
                }
            }
        }
        
        return (false, 0);
    }
    
    /**
     * @notice 查找范围内被标记的最大索引（最后一个标记的索引）
     * @param bitmap 位图映射表
     * @param startIndex 起始索引（不包含）
     * @param endIndex 结束索引（包含）
     * @return found 是否找到
     * @return maxIndex 最大索引（如果未找到则为0）
     */
    function findMaxMarked(
        mapping(uint256 => uint256) storage bitmap,
        uint256 startIndex,
        uint256 endIndex
    ) internal view returns (
        bool found,
        uint256 maxIndex
    ) {
        require(startIndex < endIndex, "Invalid range");
        
        // 搜索范围是 (startIndex, endIndex]，实际起始索引是 startIndex + 1
        uint256 actualStartIndex = startIndex + 1;
        uint256 startSlot = actualStartIndex / BITS_PER_SLOT;
        uint256 endSlot = endIndex / BITS_PER_SLOT;
        
        // 从最后一个 slot 开始向前遍历
        for (uint256 slot = endSlot; ; slot--) {
            uint256 slotValue = bitmap[slot];
            
            // 如果这个 slot 不为空，在其中查找
            if (slotValue != 0) {
                // 计算在当前 slot 中的起始和结束位置
                uint256 bitStart = (slot == startSlot) ? (actualStartIndex % BITS_PER_SLOT) : 0;
                uint256 bitEnd = (slot == endSlot) ? (endIndex % BITS_PER_SLOT) : (BITS_PER_SLOT - 1);
                
                // 从高位向低位查找最后一个被标记的位
                for (uint256 bitPos = bitEnd; ; bitPos--) {
                    if ((slotValue & (1 << bitPos)) != 0) {
                        return (true, slot * BITS_PER_SLOT + bitPos);
                    }
                    
                    if (bitPos == bitStart || bitPos == 0) {
                        break;
                    }
                }
            }
            
            // 防止下溢
            if (slot == startSlot || slot == 0) {
                break;
            }
        }
        
        return (false, 0);
    }

    /**
     * @notice 查找目标索引之前最近的被标记索引
     * @param bitmap 位图映射表
     * @param targetIndex 目标索引
     * @return found 是否找到
     * @return previousIndex 之前最近的索引（如果未找到则为0）
     */
    function findPreviousMarked(
        mapping(uint256 => uint256) storage bitmap,
        uint256 targetIndex
    ) internal view returns (
        bool found,
        uint256 previousIndex
    ) {
        // 如果目标索引为0，无法向前查找
        if (targetIndex == 0) {
            return (false, 0);
        }
        
        // 查找范围是 [0, targetIndex - 1]
        uint256 searchIndex = targetIndex - 1;
        uint256 currentSlot = searchIndex / BITS_PER_SLOT;
        
        // 从当前 slot 开始向前遍历
        for (uint256 slot = currentSlot; ; slot--) {
            uint256 slotValue = bitmap[slot];
            
            // 如果这个 slot 不为空，在其中查找
            if (slotValue != 0) {
                // 计算在当前 slot 中的结束位置
                uint256 bitEnd = (slot == currentSlot) ? (searchIndex % BITS_PER_SLOT) : (BITS_PER_SLOT - 1);
                
                // 从高位向低位查找最近的被标记的位
                for (uint256 bitPos = bitEnd; ; bitPos--) {
                    if ((slotValue & (1 << bitPos)) != 0) {
                        return (true, slot * BITS_PER_SLOT + bitPos);
                    }
                    
                    if (bitPos == 0) {
                        break;
                    }
                }
            }
            
            // 防止下溢
            if (slot == 0) {
                break;
            }
        }
        
        return (false, 0);
    }

    /**
     * @notice 检查某个索引的 bit 是否被设置
     * @param bitmap 位图映射表
     * @param index 索引
     * @return 是否被设置
     */
    function isSet(
        mapping(uint256 => uint256) storage bitmap,
        uint256 index
    ) internal view returns (bool) {
        uint256 slotIndex = index / BITS_PER_SLOT;
        uint256 bitPosition = index % BITS_PER_SLOT;
        
        uint256 mask = 1 << bitPosition;
        return (bitmap[slotIndex] & mask) != 0;
    }
    
}
