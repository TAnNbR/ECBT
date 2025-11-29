**分红分配比例**

- 投资者: 70%
- 资产提供者: 20%
- 平台费用: 10%

**分红执行流程**

1. 预言机报告收益
2. 验证收益数据
3. 计算分红（总收益 × 70%）
4. 计算每个投资者分红
5. 从 Treasury 提取资金
6. 分发给投资者
7. 记录分红历史

**核心功能**

- executeDividendDistribution() - 执行分红分配
- calculateInvestorDividends() - 计算投资者分红
- distributeDividends() - 分发分红
- executeCollateralLiquidation() - 执行清算