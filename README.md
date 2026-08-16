# 喜点什么？

一个为喜茶 DIY 饮品生成随机搭配灵感的可爱手绘风小应用。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 功能

- 进入页面自动随机一杯，支持再次摇签
- 按清爽、奶香、苦巧与 0 咖心情筛选
- 区分官方推荐、公开实测和灵感实验款
- 收藏配方、分享灵感、复制点单口令
- Neon Auth 邮箱注册 / 登录，收藏随账号跨设备同步
- 未登录收藏自动暂存，首次登录后合并进云端
- 五类原创手绘饮品插画与响应式动效界面
- 内置菜单资料来源与门店可售提示

## Neon 登录与云端收藏

项目使用 Neon Auth 管理账号与会话，使用 Neon Data API 读写收藏，并在 PostgreSQL 中通过 RLS 保证每个用户只能访问自己的数据。

### 1. 在 Neon Console 开启服务

在准备使用的 Neon 项目中：

1. 进入 **Auth**，启用 Neon Auth 与邮箱密码登录。
2. 进入 **Data API**，为同一个数据库分支启用 Data API。
3. 在 Auth 的 Allowed origins 中加入本地地址 `http://localhost:5173`；部署后再加入正式域名。

### 2. 配置本地环境变量

```bash
cp .env.example .env
```

从 Neon Console 填写：

```env
VITE_NEON_AUTH_URL=你的 Auth URL
VITE_NEON_DATA_API_URL=你的 Data API URL
DATABASE_URL=你的 pooled connection string
```

`VITE_` 开头的两个值是浏览器可用的公开服务地址。`DATABASE_URL` 含数据库密码，只能放在本地或部署平台的服务端环境变量中，不能改名为 `VITE_DATABASE_URL`。

### 3. 创建收藏表与 RLS

确保已经先开启 Neon Auth，然后执行：

```bash
npm run db:migrate
```

迁移脚本会创建 `favorite_recipes` 表、唯一约束、授权和三条按 `auth.user_id()` 隔离的 RLS 策略。SQL 源文件位于 `migrations/001_user_favorites.sql`，也可以在 Neon SQL Editor 中直接执行。

### 4. 启动并验证

```bash
npm run dev
```

注册两个测试账号，分别收藏不同饮品；互相登录时不应看到对方的收藏。部署到 Vercel 等平台时，需要配置两个 `VITE_NEON_*` 环境变量，并将正式域名加入 Neon Auth Allowed origins。部署环境不需要 `DATABASE_URL`，除非在那里运行迁移。

> 本项目不是喜茶官方产品。饮品、原料及可选项以喜茶小程序和门店当日页面为准。
