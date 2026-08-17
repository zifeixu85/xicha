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
NEON_AUTH_URL=同一个 Auth URL（服务端）
DATABASE_URL=你的 pooled connection string
DEEPSEEK_API_KEY=你的 DeepSeek API Key
MINIMAX_API_KEY=你的 MiniMax API Key
```

`VITE_` 开头的两个值是浏览器可用的公开服务地址。`NEON_AUTH_URL` 是同一个 Neon Auth 公开地址的服务端副本，用于定位 JWKS；本地未设置时会回退到 `VITE_NEON_AUTH_URL`，生产环境建议显式设置。`DATABASE_URL` 含数据库密码，只能放在本地或部署平台的服务端环境变量中，不能改名为 `VITE_DATABASE_URL`。

`DEEPSEEK_API_KEY` 和 `MINIMAX_API_KEY` 都只能配置在服务端。浏览器分别请求同源的 `/api/blessing` 与 `/api/speech`，服务端再调用 `deepseek-v4-pro` 和 MiniMax `speech-2.8-hd`，因此 Key 不会进入前端构建产物。语音只在用户点击播放后生成，MiniMax 返回的临时 URL 仅缓存于当前页面、当前签语；重新摇签会终止旧请求并清空音频。部署到 Vercel 时，同样需要配置这两个服务端环境变量，以及 `NEON_AUTH_URL`。

祝福接口会为当前签语签发短时播放凭证，语音接口只接受与该凭证匹配且不超过 120 字的文本；这个 HMAC 凭证与登录校验是两道独立检查。心情输入第一版只随本次请求发送，不写入账号数据库或本地存储。

### 多模态 API 鉴权契约

音频、图片、视频生成必须使用同一套服务端鉴权，不能把隐藏或禁用前端按钮当成安全边界。当前浏览器协议是：

1. 请求前调用 `neonClient.auth.getSession()`，从 `data.session.token` 读取当前短期 JWT；token 只保留在 Neon Auth 的内存会话中，不写入 `localStorage`。
2. 向同源 API 添加 `Authorization: Bearer <token>`；前端 helper 会拒绝跨域目标，避免误把 token 发给第三方。
3. 服务端 `server/auth.mjs` 从 `NEON_AUTH_URL`（或回退的 `VITE_NEON_AUTH_URL`）加载 `/jwks`，验证签名、`iss`、`aud`、`exp`，要求 `role=authenticated` 并拒绝 Neon 匿名 token，只把验签后的 `sub` 作为用户 ID。请求体里的 `userId`、`email` 一律不可信。
4. 缺失、过期、伪造 token 统一返回 `401 AUTH_REQUIRED`；Auth URL 配置错误、JWKS 网络或服务异常统一返回 `503 AUTH_UNAVAILABLE`。

JWT 是 Neon Auth 签发的短期服务凭证（当前 Better Auth 默认约 15 分钟），服务端每次都校验其有效期。主动退出后，已经签发的 JWT 最迟会在自身 `exp` 到期时失效；本项目不持久化 token，以缩小暴露窗口。

实现依据是当前 `@neondatabase/neon-js` 的 `set-auth-jwt` 会话行为，以及 Better Auth 的 [JWT/JWKS 验证契约](https://better-auth.com/docs/plugins/jwt)。

当前 `/api/speech` 已同时接入这套登录校验与原有短时 HMAC speech ticket。后续新增图片或视频 handler 时，在读取业务身份或调用供应商之前复用同一个 guard：

```js
import { requireAuthenticatedUser } from "./server/auth.mjs";

const auth = await requireAuthenticatedUser(request, response);
if (!auth) return;
// 这里只使用 auth.user.id；随后才校验输入、限流并调用生成服务。
```

这段接口同时兼容 Express 的 `request/response` 和 Vercel Node handlers；测试时也可以向 `authenticateRequest` 注入本地 JWKS key set，不需要绕过生产验证逻辑。

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
