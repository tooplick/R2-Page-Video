# 项目结构

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