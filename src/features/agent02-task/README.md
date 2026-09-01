# 专项任务管理智能体（已实现 M16–M18）

- 目录 key：`agent02-task`
- 需求文档：`doc/子功能/02_专项任务管理智能体_详细功能设计.md`
- 功能精化（3 个菜单，原 4 功能组合并为 3 页）：

| 菜单 | 路由 | 覆盖功能 | 说明 |
|---|---|---|---|
| M16 任务生成与派发 | `/task/generate` | 3.1 线索聚类/去重/要素生成 + 3.2 派发 | 合并：聚类→去重→确认→派发是一条连贯操作链 |
| M17 任务进度管控 | `/task/progress` | 3.3 进度管控/看板/督办 | 泳道与列表双视图切换 |
| M18 任务结果管理 | `/task/result` | 3.4 结果整合/复核/推送 | 左栏列表+右栏详情布局 |

## 落位约定

| 层 | 路径 |
|---|---|
| 页面 | `src/features/agent02-task/{generate,progress,result}/` |
| 接口 | `src/api/agent02-task/task.ts` |
| Mock | `mock/agent02-task/task.ts` |
| 数据 | `mock/shared/data/tasks.ts` |
| 路由 | `src/router/agent02-task.ts` |

已在 `src/router/index.ts` 中 `ready: true`；门户卡片已同步更新（`mock/shared/data/agents.ts`）。

