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

```bash
# 开发模式
npm run dev

# 构建并部署
npm run build
npx wrangler pages deploy dist
```

### ADMIN_PASSWORD 配置

本工具支持通过环境变量 `ADMIN_PASSWORD` 配置初始管理员密码：

1. 在 Cloudflare Dashboard 中进入 Pages 项目设置
2. 进入 **Settings** > **Environment variables**
3. 添加环境变量：
   - **Variable name**: `ADMIN_PASSWORD`
   - **Value**: 你的管理员密码
4. 点击 **Save**
5. 重新部署项目

- 首次部署时会显示初始化向导，设置管理员密码
- 如果配置了 `ADMIN_PASSWORD` 环境变量，将跳过初始化向导直接使用该密码
- 密码存储在 KV 中，使用 AES-256-GCM 加密
- 会话有效期为 24 小时

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
