# R2-Page-Video

基于 Cloudflare Workers + R2 的视频托管网站。

## 功能

- **视频上传** — 客户端直传 R2（预签名 URL），支持 500MB 以内视频
- **视频播放** — HTML5 播放器，支持 Range 请求拖动进度条
- **视频下载** — 一键下载原始视频文件
- **封面自动生成** — 上传时自动截取视频帧作为封面，可手动选择帧
- **GitHub OAuth 登录** — 所有功能需登录，任何 GitHub 用户可上传
- **Pinterest 瀑布流** — Masonry 网格布局，响应式 1-6 列自适应

## 技术栈

| 层 | 技术 |
|---|------|
| 运行时 | Cloudflare Workers |
| 后端框架 | Hono v4 |
| 前端 | Vanilla HTML/CSS/JS (SPA) |
| 视频存储 | Cloudflare R2 |
| 元数据 | Cloudflare D1 (SQLite) |
| 认证 | GitHub OAuth + JWT Cookie |
| 大文件上传 | aws4fetch 预签名 URL |

## 部署

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 Cloudflare 资源

```bash
# 创建 D1 数据库
npx wrangler d1 create r2-page-video-db

# 创建 R2 存储桶
npx wrangler r2 bucket create r2-page-video
```

将 `wrangler d1 create` 输出的 `database_id` 填入 `wrangler.jsonc`。

### 3. 初始化数据库

```bash
npx wrangler d1 execute r2-page-video-db --file=src/db/schema.sql
```

### 4. 注册 GitHub OAuth App

前往 [GitHub Developer Settings](https://github.com/settings/developers) 创建 OAuth App：

- **Authorization callback URL**: `https://<your-worker>.workers.dev/api/auth/callback`

在 `wrangler.jsonc` 中填写 `GITHUB_CLIENT_ID` 和 `GITHUB_REDIRECT_URI`。

### 5. 创建 R2 API Token

在 Cloudflare Dashboard → R2 → 管理 API 令牌，创建一个具有读写权限的 S3 兼容 API Token。

### 6. 配置 R2 CORS

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

### 7. 设置 Secrets

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put JWT_SECRET
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put CF_ACCOUNT_ID
```

### 8. 部署

```bash
npm run deploy
```

## 本地开发

```bash
# 复制 .dev.vars.example 并填入实际值
cp .dev.vars.example .dev.vars

# 本地启动
npm run dev
```

## 项目结构

```
├── public/                 # 静态资源（Workers Static Assets 托管）
│   ├── index.html          # SPA 入口
│   ├── css/style.css       # Pinterest 风格样式
│   └── js/                 # 前端模块
│       ├── app.js          # SPA 路由
│       ├── api.js          # API 请求封装
│       ├── auth.js         # 登录状态管理
│       ├── pages/          # 页面（首页、播放、上传）
│       └── components/     # 组件（导航栏、视频卡片）
├── src/                    # Worker 后端
│   ├── index.ts            # Hono 应用入口
│   ├── types.ts            # TypeScript 类型
│   ├── routes/             # API 路由（auth、videos、upload）
│   ├── middleware/          # JWT 认证中间件
│   ├── services/           # 业务逻辑（GitHub、D1、R2、JWT）
│   └── db/schema.sql       # 数据库建表
├── wrangler.jsonc          # Cloudflare Workers 配置
└── DESIGN.md               # Pinterest 风格设计规范
```

## License

MIT
