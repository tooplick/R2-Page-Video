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

## 部署教程

详情查看部署指南：[DEPLOY.md](./DEPLOY.md)

### 设置管理员

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

查看项目结构：[Structure.md](./Structure.md)

## 单位说明

全站存储用量显示使用**十进制 GB（1000³）**，与 Cloudflare Dashboard 显示的桶大小一致，而非二进制 GiB（1024³）。

## License

MIT
