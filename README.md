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

### 方式一：Cloudflare Dashboard（推荐）

本项目支持通过 Cloudflare Dashboard 直接部署为 **Pages** 应用

#### 步骤 1：创建 KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** > **KV**
3. 点击 **Create a namespace**
4. **命名空间名称必须为：`TOOL_DATA`**
5. 点击 **Add**

> KV 命名空间名称必须为 `TOOL_DATA`，这是项目预设的绑定名称

#### 步骤 2：部署 Pages 项目

1. 进入 **Workers & Pages** > **Overview**
2. 点击 **Create application**
3. 选择 **Pages** > **Upload assets**
4. 输入项目名称（例如 `multi-worker`）
5. 上传 `dist` 目录下的所有文件

或者使用命令行上传：

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 使用 wrangler 上传
npx wrangler pages deploy dist --project-name=multi-worker
```

#### 步骤 3：绑定 KV 命名空间

1. 进入 Pages 项目的 **Settings** > **Functions** > **KV namespace bindings**
2. 点击 **Add binding**
3. 配置：
   - **Variable name**: `TOOL_DATA`
   - **KV namespace**: 选择步骤 1 创建的 `TOOL_DATA`
4. 点击 **Save**

> 绑定后需要重新部署才能生效

### 方式二：Wrangler CLI 部署

#### 步骤 1：修改 wrangler.toml

在项目根目录修改 `wrangler.toml`：

```toml
name = "multi-worker"
pages_build_output_dir = "dist"
compatibility_date = "2024-01-01"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "TOOL_DATA"
id = "你的KV命名空间ID"
```

#### 步骤 2：获取 KV 命名空间 ID

```bash
# 列出所有 KV 命名空间
npx wrangler kv namespace list

# 或者创建新的
npx wrangler kv namespace create "TOOL_DATA"
```

#### 步骤 3：部署

**重要：** 本项目使用 Cloudflare Pages Functions，部署时需要包含 `functions` 目录。

```bash
# 开发模式（仅前端）
npm run dev

# 本地测试完整功能（包含 Functions）
npm run build
npx wrangler pages dev dist

# 构建并部署到 Cloudflare Pages
npm run build
npx wrangler pages deploy
```

**注意：** 不要使用 `npx wrangler pages deploy dist`，这只会部署静态文件，不会部署 Functions。

正确的部署命令是 `npx wrangler pages deploy`（不指定目录），它会自动：
1. 部署 `dist` 目录中的静态文件
2. 部署 `functions` 目录中的 Cloudflare Pages Functions

### ADMIN_PASSWORD 配置

本工具支持通过环境变量 `ADMIN_PASSWORD` 配置初始管理员密码：

1. 在 Cloudflare Dashboard 中进入 Pages 项目设置
2. 进入 **Settings** > **Environment variables**
3. 添加环境变量：
   - **Variable name**: `ADMIN_PASSWORD`
   - **Value**: 你的管理员密码（至少 8 个字符）
4. 点击 **Save**
5. **重新部署项目**（环境变量设置后必须重新部署才能生效）

**密码配置方式：**

- **方式一（推荐）**：配置 `ADMIN_PASSWORD` 环境变量
  - 首次访问时自动完成初始化，无需手动设置密码
  - 更安全，密码不通过界面传输
  
- **方式二**：通过初始化向导设置
  - 首次访问时显示初始化页面
  - 手动输入密码完成设置

**环境变量生效流程：**

1. 设置 `ADMIN_PASSWORD` 环境变量
2. 运行 `npm run build` 构建项目
3. 运行 `npx wrangler pages deploy` 重新部署
4. 首次访问时，系统会自动使用 `ADMIN_PASSWORD` 完成初始化

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

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### 项目结构

```
multi-worker/
├── src/
│   ├── components/       # React 组件
│   │   ├── accounts/     # 账户管理组件
│   │   ├── layout/       # 布局组件
│   │   ├── pages/        # Pages 管理组件
│   │   ├── ui/           # UI 基础组件
│   │   └── workers/      # Workers 管理组件
│   ├── contexts/         # React Context
│   ├── hooks/            # 自定义 Hooks
│   ├── pages/            # 页面组件
│   └── types/            # TypeScript 类型定义
├── Cloudflare API Doc/   # Cloudflare API 文档参考
└── Cloudflare Frontend Example/  # 前端界面参考
```

## API 依赖

本项目使用以下 Cloudflare API：

- **Workers API**: `/accounts/{account_id}/workers/*`
- **Pages API**: `/accounts/{account_id}/pages/*`
- **KV API**: `/accounts/{account_id}/storage/kv/*`
- **D1 API**: `/accounts/{account_id}/d1/*`

## License

MIT
