> [!CAUTION]
> 
> # This project is under development
>
> Errors may occur

# Multi-Worker

Cloudflare Workers & Pages 多账户管理工具。支持管理多个 Cloudflare 账户的 Workers、Pages、KV、D1 等资源。

## 功能

- 多账户管理：添加/删除 Cloudflare 账户，统一管理
- Workers 管理：创建、删除、部署、绑定配置
- Pages 管理：创建、删除、部署项目
- KV 管理：命名空间管理、键值浏览/编辑
- D1 管理：数据库管理、SQL 查询

## 部署

本项目是 **Cloudflare Pages** 应用：`dist/` 为静态产物，API 全部由 `functions/` 目录下的 Pages Functions 提供。因此**必须使用 Wrangler CLI 部署**（Dashboard 拖拽上传不支持 `functions/` 目录）。

### 步骤 1：创建 KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** > **KV**
3. 点击 **Create a namespace**（名称任意，例如 `TOOL_DATA`）
4. 点击 **Add**

或使用命令行：

```bash
npx wrangler kv namespace create "TOOL_DATA"
```

### 步骤 2：配置 wrangler.toml（KV 绑定的单一事实源）

KV 绑定以 `wrangler.toml` 内的 `id` 为准（单一事实源），Dashboard 中的绑定仅作兜底：

```toml
name = "multi-worker-manager"
compatibility_date = "2026-10-01"
pages_build_output_dir = "dist"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "TOOL_DATA"
id = "你的KV命名空间ID"
```

- `binding` 必须为 `TOOL_DATA`（代码中引用的环境变量名）
- `id` 来自 Cloudflare Dashboard → KV → 该命名空间的 ID，或 `npx wrangler kv namespace list` 的输出

### 步骤 3：构建并部署（推荐：Wrangler CLI）

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 部署：dist 静态文件 + functions/ Pages Functions 一并上传
npx wrangler pages deploy dist --project-name=multi-worker
```

`wrangler pages deploy` 在项目根目录执行时，会自动把 `functions/` 目录随项目一起上传（Functions 路由先于 `_redirects` 匹配，`/api/*` 不会被 SPA 兜底遮蔽）。首次部署前可先 `npx wrangler pages project create` 创建项目。

**替代方案（不推荐）：Dashboard 上传 dist**

Cloudflare Dashboard 的拖拽上传仅上传静态资产，**不支持 `functions/` 目录**，部署后 `/api/*` 全部不可用。仅当你想预览纯前端页面时使用；完整功能请用 Wrangler CLI。

### 步骤 4：环境变量与密钥

#### TOKEN_ENC_KEY（Worker Secret）

账户 API token 的加密密钥（AES-256-GCM）：

- 格式：base64 编码的 256-bit key，可用 `openssl rand -base64 32` 生成
- 设置方式（二选一）：
  - CLI：`npx wrangler pages secret put TOKEN_ENC_KEY --project-name=multi-worker`
  - Dashboard：Pages 项目 → **Settings** → **Environment variables** → **Secrets**

> [!WARNING]
> **部署顺序**：Secret 一旦配置即刻生效——`resolveEncryptionKey` 见到 `TOKEN_ENC_KEY` 就会用它解密，而存量账户 token 仍用 KV 旧密钥加密，**未执行迁移前这些 token 无法解密（账户会显示 token 无效）**。正确顺序：配置 Secret → **立即**调用 `POST /api/settings/migrate-encryption`（登录后）→ 验证账户列表/校验可用。两者之间不要间隔操作。

#### ENCRYPTION_KEY_SOURCE（回滚开关，可选）

取值 `kv` | `env`，用于控制加密密钥来源：

- `env`：使用 `TOKEN_ENC_KEY`（推荐）
- `kv`：使用 KV 中的旧密钥（回滚用）
- 未设置时：若 `TOKEN_ENC_KEY` 存在则优先 `env`，否则走 KV 旧密钥

#### 一次性迁移端点

存在一次性迁移端点 `POST /api/settings/migrate-encryption`（登录后调用）：把 KV 旧密钥加密的账户 token 重加密到 `TOKEN_ENC_KEY` 并删除旧键。迁移端点是**两阶段**执行（先全部解密验证，任一失败则零写入中止；再重加密写回），返回 `{success, migrated, message}`。迁移后建议保留 `ENCRYPTION_KEY_SOURCE=env`。

**备份与回滚**：迁移前旧密钥会自动备份到 `config:encryption_key_backup`。如需回滚：

1. 设置 `ENCRYPTION_KEY_SOURCE=kv`（强制走 KV 旧键）
2. 如需要，从 `config:encryption_key_backup` 恢复 `config:encryption_key`

注意：迁移成功后 `config:encryption_key` 会被删除（备份仍在 `config:encryption_key_backup`）。

#### ADMIN_PASSWORD（可选）

初始管理员密码（至少 8 个字符），通过 Dashboard **Settings** > **Environment variables** 添加，设置后需重新部署生效：

- **方式一（推荐）**：配置 `ADMIN_PASSWORD` 环境变量，首次访问自动完成初始化，密码不经过界面传输
- **方式二**：不配置该变量，首次访问时通过初始化向导手动设置密码

**安全说明：**

- 密码存储在 KV 中，使用 SHA-256 哈希
- API Token 使用 AES-256-GCM 加密存储
- 会话有效期为 24 小时
- 所有 API 请求需要有效的会话 Cookie

## 开发

### 环境要求

- Node.js 18+
- npm 或 yarn

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（仅前端）
npm run dev

# 构建生产版本
npm run build

# 本地测试完整功能（含 Pages Functions）
npm run dev:pages

# 预览生产版本
npm run preview

# 代码检查
npm run lint

# functions/ 类型检查
npm run typecheck:functions
```

### 项目结构

```
multi-worker/
├── index.html              # Vite 入口
├── wrangler.toml           # Pages 配置（KV 绑定以这里为准）
├── public/                 # 静态资源，构建时原样拷入 dist/
│   ├── _headers            # 安全响应头（CSP 等）
│   ├── _redirects          # SPA 兜底（/* -> /index.html）
│   └── favicon.svg
├── src/                    # 前端（React + Vite + Tailwind）
│   ├── components/         # 通用组件（accounts / dashboard / layout / pages / ui / workers）
│   ├── contexts/           # Auth / Toast 上下文
│   ├── hooks/              # useAuth / useTheme / useToast
│   ├── pages/              # 页面：Accounts / Auth / D1 / Dashboard / KV / Pages / Settings / Workers
│   └── types/              # 前端类型定义
├── functions/              # Cloudflare Pages Functions（后端 API）
│   ├── _middleware.ts      # 会话校验等中间件
│   ├── api/                # REST 端点（约 33 个），按资源域组织：
│   │   ├── accounts/       # 账户 CRUD + verify
│   │   │   └── [id]/       # workers / pages / kv / d1 子资源（列表、部署、绑定、查询等）
│   │   ├── auth/           # login / logout / setup / status
│   │   ├── batch/          # 批量部署 / 批量删除
│   │   ├── resources/      # 跨资源汇总
│   │   └── settings/       # 外观 / 密码 / 加密迁移
│   └── lib/                # cloudflare API 封装 / crypto / kv 工具
└── eslint.config.js        # ESLint flat config
```

## API 依赖

本项目使用以下 Cloudflare API：

- **Workers API**: `/accounts/{account_id}/workers/*`
- **Pages API**: `/accounts/{account_id}/pages/*`
- **KV API**: `/accounts/{account_id}/storage/kv/*`
- **D1 API**: `/accounts/{account_id}/d1/*`

## License

MIT
