# 喜点什么？

一个为喜茶 DIY 饮品生成随机搭配灵感的可爱手绘风小应用。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器会同时提供 Vite 页面与同源的 `/api/blessing` 服务，默认地址为 `http://localhost:5173`。

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
- 可选填写 120 字以内的此刻近况，每次随机后由 DeepSeek V4 Pro 结合饮品、当地时间与用户心情生成不重复签语
- 首次点击时按需调用 MiniMax 生成温柔女声签语，当前签语内缓存并支持暂停、继续与重播
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
DEEPSEEK_API_KEY=你的 DeepSeek API Key
MINIMAX_API_KEY=你的 MiniMax API Key
```

`VITE_` 开头的两个值是浏览器可用的公开服务地址。`DATABASE_URL` 含数据库密码，只能放在本地或部署平台的服务端环境变量中，不能改名为 `VITE_DATABASE_URL`。

`DEEPSEEK_API_KEY` 和 `MINIMAX_API_KEY` 都只能配置在服务端。浏览器分别请求同源的 `/api/blessing` 与 `/api/speech`，服务端再调用 `deepseek-v4-pro` 和 MiniMax `speech-2.8-hd`，因此 Key 不会进入前端构建产物。语音只在用户点击播放后生成，MiniMax 返回的临时 URL 仅缓存于当前页面、当前签语；重新摇签会终止旧请求并清空音频。部署到 Vercel 时，同样需要配置这两个服务端环境变量。

祝福接口会为当前签语签发短时播放凭证，语音接口只接受与该凭证匹配且不超过 120 字的文本。心情输入第一版只随本次请求发送，不写入账号数据库或本地存储。

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
