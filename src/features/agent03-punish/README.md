# 违规处置智能体（已实现 M19–M24）

- 目录 key：`agent03-punish`
- 需求文档：`doc/子功能/03_违规处置智能体_详细功能设计.md`
- 功能精化：文档建议 M01–M20 共 **20 个模块**，按「每功能大类最多 2 个菜单」压缩为 **6 个页面**

| 菜单 | 路由 | 覆盖文档模块 | 页内结构 |
|---|---|---|---|
| M19 违规确认与复核 | `/punish/confirm` | M01+M02+M03+M04+M05 | 4 Tab：AI定性 / 责任界定 / 双人复核 / 报告送达 |
| M20 分类处置 | `/punish/handle` | M06+M07+M08+M09 | 3 Tab：协议处理 / 行政处罚（12节点）/ 移送处理 + 依据推荐弹窗 |
| M21 基金追回台账 | `/recovery/fund` | M10+M11 | 台账列表 + 到账核销弹窗（三分支规则联动） |
| M22 整改跟踪 | `/recovery/rectify` | M16+M17 | 清单下达 + 逐项复查 + 整体验收 |
| M23 闭环销号 | `/closure/cancel` | M18+M19+M20 | 3 Tab：条件核验（5项）/ 销号审批 / 信用联动 |
| M24 台账与经验沉淀 | `/closure/ledger` | M12+M13+M14+M15 | 5 Tab：战果统计 / 档案 / 标准口径 / 典型案例 / 复盘迭代 |

## 落位约定

| 层 | 路径 |
|---|---|
| 页面 | `src/features/agent03-punish/{confirm,handle,recovery,rectify,cancel,ledger}/` |
| 接口 | `src/api/agent03-punish/punish.ts` |
| Mock | `mock/agent03-punish/punish.ts` |
| 数据 | `mock/shared/data/punish.ts` |
| 路由 | `src/router/agent03-punish.ts`（3 个菜单分组） |

已在 `src/router/index.ts` 中 `ready: true`；门户卡片已同步更新（`mock/shared/data/agents.ts`）。

