# R2-Page-Video

基于 Cloudflare Workers + R2 的视频托管网站。

## 功能

- **视频上传** — 客户端直传 R2（预签名 URL）绕过 Worker 100MB 请求体上限
- **可配置配额** — 管理员可在线调整「单文件大小上限」与「总存储空间上限」（默认 1.00 GB / 9.9 GB）
- **GitHub OAuth 登录 / 游客模式** — 完整功能需 GitHub 登录；游客可只读浏览
- **自声明管理员** — 首个登录后访问 `#/admin` 的用户自动成为管理员，之后仅管理员能调整配额

## 技术栈

| 层 | 技术 |
|---|------|
| 运行时 | Cloudflare Workers |
| 后端框架 | Hono v4 |
| 前端 | Vanilla HTML/CSS/JS |
| 视频存储 | Cloudflare R2 |
| 元数据 | Cloudflare D1（SQLite） |
| 认证 | GitHub OAuth + 自签 JWT（HttpOnly Cookie） |
| 大文件上传 | aws4fetch 预签名 PUT URL |
| 定时任务 | Cloudflare Cron Triggers（每小时） |

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

### 3. 初始化数据库（可选）

```bash
npx wrangler d1 execute r2-page-video-db --file=src/db/schema.sql
```

> 也可跳过 — 首个 `/api/*` 请求会执行 `CREATE TABLE IF NOT EXISTS`，幂等。

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

部署后 `wrangler.jsonc` 里的 `triggers.crons: ["0 * * * *"]` 会自动生效——每小时整点触发一次 R2 孤儿文件清理。也可以 admin 身份手动调 `POST /api/admin/cleanup-orphans` 立即清理。

### 9. 认领管理员

部署后用 GitHub 登录，手动访问 `https://<your-domain>/#/admin` 即自动成为管理员，头部出现「管理」入口，可在线调整配额。

> 换管理员：`npx wrangler d1 execute r2-page-video-db --command "DELETE FROM settings WHERE key='admin_user_id'"`，下一个访问 `#/admin` 的登录用户成为新管理员。

## 本地开发

```bash
# 复制 .dev.vars.example 并填入实际值
cp .dev.vars.example .dev.vars

# 本地启动
npm run dev

# 类型检查（项目无测试套件）
npx tsc --noEmit

# 实时日志
npx wrangler tail
```

`.dev.vars` 需要包含所有 secrets。

## 项目结构

```
├── public/                    # 静态资源（Workers Static Assets 托管）
│   ├── index.html             # SPA 入口
│   ├── css/style.css          # Pinterest 风格样式
│   └── js/                    # 前端模块
│       ├── app.js             # SPA 路由（#/ #/video/:id #/upload #/admin #/login）
│       ├── api.js             # fetch 封装 + 401 事件
│       ├── auth.js            # getUser / isGuest / isAdmin 状态管理
│       ├── pages/             # home / video / upload / admin
│       └── components/        # header / video-card
├── src/                       # Worker 后端
│   ├── index.ts               # Hono 入口 + scheduled 定时处理器 + 首次请求幂等建表
│   ├── types.ts               # Env / Video / JwtPayload
│   ├── routes/
│   │   ├── auth.ts            # GitHub OAuth、/me、游客登录
│   │   ├── videos.ts          # 列表、详情、流式播放、下载、删除
│   │   ├── upload.ts          # 预签名 + 完成回调（动态配额校验）
│   │   ├── admin.ts           # POST /claim 自声明管理员 + POST /cleanup-orphans 手动清理
│   │   └── settings.ts        # GET/PUT 配额
│   ├── middleware/
│   │   ├── auth.ts            # authRequired / authOptional / notGuest
│   │   └── admin.ts           # adminRequired
│   ├── services/
│   │   ├── github.ts          # OAuth token 换取 + 用户信息
│   │   ├── jwt.ts             # Web Crypto HMAC-SHA256 自签
│   │   ├── d1.ts              # videos 表 CRUD + getAllR2Keys 用于清理
│   │   ├── r2.ts              # 预签名 URL + Range 解析
│   │   ├── cleanup.ts         # 孤儿文件扫描清理（R2 vs D1 差集）
│   │   └── settings.ts        # 配额读写、用量统计、管理员认领
│   └── db/schema.sql          # videos + settings 表
├── wrangler.jsonc             # Cloudflare Workers 配置（含 cron trigger）
├── DESIGN.md                  # Pinterest 风格设计规范
└── CLAUDE.md                  # 给 Claude Code 的项目上下文
```

## 单位说明

全站存储用量显示使用**十进制 GB（1000³）**，与 Cloudflare Dashboard 显示的桶大小一致，而非二进制 GiB（1024³）。

## License

MIT
