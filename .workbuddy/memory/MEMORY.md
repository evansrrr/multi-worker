# multi-worker 项目记忆

## 项目性质
Cloudflare Workers/Pages 多账户管理工具。前端 React 18 + Vite + Tailwind + react-router v6；后端 Cloudflare Pages Functions（`functions/`），数据存 KV `TOOL_DATA`。设计文档在 `docs/compose/`（注意 `.gitignore` 忽略了 docs/、Cloudflare API Doc/）。

## 关键约定
- `tsconfig.json` 的 include 只有 `src`，`functions/` 不参与 `npm run build` 的类型检查（需单独跑 tsc 或加 tsconfig.functions.json）。
- Cloudflare API 正确用法以本地 `Cloudflare API Doc/` 为准；Workers 上传代码必须走 `PUT /accounts/{id}/workers/scripts/{script_name}`（multipart metadata + module），而 Beta `/workers/workers` 只收 JSON、不接受脚本，二者不可混用。
- KV list keys 返回 `result` 数组 + `result_info.cursor`（不是 `{keys,list_complete}`）。
- Workers/Pages/KV 列表都有 `result_info` 分页，默认约 20 条。
- `cloudflareFetch` 无条件注入 `Content-Type: application/json` — 所有 multipart 请求必须绕过它或先修掉该注入；传 FormData 的 fetch 一律不要手动设 Content-Type（boundary 会丢）。
- D1 `POST /query` 的 SQL 错误在 `result[0].success === false`，外层 `success` 仍为 true。
- 主题现状：Light 模式物理失效（颜色硬编码 cf-dark-*、body 写死暗色），重构主题前不要按"暗色已可用"假设写样式。
- 界面为中文用户，遵循涨红跌绿等中文金融/界面惯例；文案目前中英混用，待统一。

## 2026-10-27 审查产出
`AUDIT-2026-10-27.md`（根目录）：P0 九项（安全、Worker 部署/创建、KV 模块、分页、Pages 部署、批量部署、主题、导航）+ P1/P2 清单 + 功能路线图 F1–F20 + 实施顺序与验收清单。四类系统性病灶：Workers 双 API 体系混用、请求体构造错误（JSON Content-Type 污染 multipart / zip 当 JS 上传）、响应解析按记忆而非文档（KV keys、updated_on vs modified_on、分页、D1 错误位）、UI 无统一约束（主题失效、列表行不可点、三套反馈并存、零移动端）。

## 2026-10-27 阶段1 已完成
链路修复 H2/H3/H4/H5/H6/H7 + M1/M2 全部落地，6 个提交（dd4ff07 → dd13e54）：
- **M2/M1** `functions/lib/cloudflare.ts`：Content-Type 仅在 JSON body 时注入；parseCfResponse 加 content-type 守卫。
- **H2/H3** Worker 部署/创建：改走 `PUT /workers/scripts/{name}` multipart；部署前读 settings 回传 bindings/compatibility_date/flags（**方案A 读取后回传**，用户选定）；创建走 Beta JSON + 上传初始脚本，失败回滚。
- **H4** KV 三处：keys.ts 返回 `{keys, cursor, list_complete}`（cursor 取自 result_info）；[key].ts 仅 metadata/expiration 时用 multipart，否则 raw body；key percent-encode；KV/Index.tsx 新建键受控 + 必填，`size` 列改 `metadata`。
- **H5** Workers/Pages 列表 page/per_page + result_info 透传 + 前端 Load More。
- **H6** Pages Deploy 死按钮：DeployModal 加 ZIP 拖拽上传（用户选**直传模式**），提交 FormData；Workers 时间字段 `updated_on` 兜底（H6 相关）。
- **H7** batch/deploy.ts：manifest TS2322 修；deployWorker 解 ZIP 取入口模块（worker.js/index.js/首 .js）走 scripts 端点保留绑定；Pages manifest 改 `{"path":"hash"}` 简式。
- **M1** D1 错误位：query.ts 透出 `statement_errors`，tables.ts 在 `result[0].success===false` 时 502。
- 工程：`tsconfig.functions.json` + `npm run typecheck:functions` 让 functions/ 纳入 tsc；crypto.ts WebCrypto 类型、verify.ts 未用 import 顺手修。

**验收**：`npm run build` 通过；`typecheck:functions` 0 错误；`git log` 6 commits 干净分组；eslint 配置缺失是预存问题（未引入）。

**已知未做**（待用户排期）：
- Pages Direct Upload 5 步协议（upload-token → check-missing → upload → upsert-hashes → deployment）未实现；目前 pages 部署只发 POST /deployments，**assets 未上传可能仍失败**。属 F 系列补全。
- `pages/[name]/deploy.ts` 的 manifest 也是 `{hash,size}` 错格式（与 batch 同病），阶段1 未改（用户选择只修 batch）。
- eslint.config.js 缺失（`npm run lint` 报错）。
- 阶段2（H1 安全 + M8/M9/M10）、阶段3（H8/H9 主题 + 导航 + M11）、阶段4（F1–F20 功能扩展）待排。
