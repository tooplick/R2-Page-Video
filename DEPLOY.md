## 部署指南

### 部署前准备:

#### 1. 一个Cloudflare 账户

- 注册 [Cloudflare 账户](https://dash.cloudflare.com/sign-up)
- 确保账户已验证邮箱并绑定支付方式
- 准备一个域名 (可选，Cloudflare 会提供子域名)

#### 2. 注册 GitHub OAuth App

前往 [GitHub Developer Settings](https://github.com/settings/developers) 创建 OAuth App：

- **Authorization callback URL**: `https://<your-worker>.workers.dev/api/auth/callback`

在 `wrangler.jsonc` 中填写 `GITHUB_REDIRECT_URI`。

### 3. 创建 R2 API Token

在 Cloudflare Dashboard → R2 → 管理 API 令牌，创建一个具有读写权限的 S3 兼容 API Token。

### 4. 配置 R2 CORS

在 Cloudflare Dashboard → R2 → 存储桶 → 设置 → CORS 策略：

```json
[
  {
    "AllowedOrigins": ["https://<your-worker>.workers.dev"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

#### 5. 环境变量准备：

- `GITHUB_CLIENT_ID`：GitHub OAuth App 的 Client ID
- `GITHUB_CLIENT_SECRET`：GitHub OAuth App 的 Client Secret 
- `JWT_SECRET`：JWT 加密随机字符串
- `R2_ACCESS_KEY_ID`：R2 API Token 的 Access Key ID
- `R2_SECRET_ACCESS_KEY`：R2 API Token 的 Secret Access Key
- `CF_ACCOUNT_ID`：Cloudflare 账户 ID

## 部署方式

### 方式一：Cloudflare Pages 部署

#### 1. Fork 本仓库并提交更新`wrangler.jsonc`：

```
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "r2-page-video" # 修改这个（可选）
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "r2-page-video-db",  # 修改这个（可选）
      "database_id": "<--Your database id--->"  # 修改这个
    }
  ],
  "vars": {
    "GITHUB_REDIRECT_URI": "https://<your-worker>.workers.dev/api/auth/callback"  # 修改这个
  },
```

#### 2. 配置构建设置:

进入 Cloudflare Dashboard → 计算 → Workers and Pages → 创建应用程序 → 创建Worker → 连接 GitHub 仓库：

| 配置项       | 值                                     |
| ------------ | -------------------------------------- |
| **项目名称** | `your-app-name`                        |
| **生产分支** | `main`                                 |
| **构建命令** | `npm install`                      |
| **部署命令** | `npx wrangler deploy` |
| **根目录**   | `/public`                                    |

#### 3. 设置环境变量

在 **Settings** → **Environment variables** 中添加以下环境变量：

#### 🔐 必需的环境变量（生产环境）

```
# Github OAuth
GITHUB_CLIENT_ID=your_github_client_id

GITHUB_CLIENT_SECRET=your_github_client_secret

# JWT 加密随机字符串
JWT_SECRET=your_jwt_secret_at_least_32_characters_long

# Cloudfire 资源访问
R2_ACCESS_KEY_ID=your_r2_access_key_id

R2_SECRET_ACCESS_KEY=your_r2_secret_access_key

CF_ACCOUNT_ID=your_cloudflare_account_id
```

配置完重试构建即可

### 方式二：使用 Wrangler CLI 手动部署

#### 1. Clone 仓库并进入目录

```bash 
git clone https://github.com/tooplick/R2-Page-Video
cd R2-Page-Video
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 创建 Cloudflare 资源

```bash
# 登录Cloudflare账户
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create r2-page-video-db

# 创建 R2 存储桶
npx wrangler r2 bucket create r2-page-video
```

修改`wrangler.jsonc`中的相关配置。

#### 4. 初始化数据库（可选）

```bash
npx wrangler d1 execute r2-page-video-db --file=src/db/schema.sql
```

> 也可跳过 — 首个 `/api/*` 请求会执行 `CREATE TABLE IF NOT EXISTS`，幂等。

### 5. 设置 Secrets

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put JWT_SECRET
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put CF_ACCOUNT_ID
```

### 6. 部署

```bash
npm run deploy
```
