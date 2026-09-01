# 系统管理与支撑模块（待生成）

- 目录 key：`agent06-system`
- 需求文档：`doc/子功能/06_系统管理与支撑模块_详细功能设计.md`
- 功能分组：动态规则引擎 / 知识图谱管理 / 政策法规案例库 / 数据源与接口 / 组织与权限 / 数据安全与审计 / 消息与时限督办 / 运行监控

## 落位约定

| 层 | 路径 |
|---|---|
| 页面 | `src/features/agent06-system/<业务域>/` |
| 接口 | `src/api/agent06-system/<业务域>.ts` |
| Mock | `mock/agent06-system/<业务域>.ts` |
| 路由 | `src/router/agent06-system.ts` |

生成完成后，把 `src/router/index.ts` 中该智能体的 `ready` 改为 `true` 即可进入菜单。

详见 `doc/前端目录架构约定.md`。

