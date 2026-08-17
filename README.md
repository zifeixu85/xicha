# 喜点什么？

一个为喜茶 DIY 饮品生成随机搭配灵感的可爱手绘风小应用。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器会同时提供 Vite 页面与同源 API，默认地址为 `http://localhost:5173`。

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
- 可选填写 120 字以内的此刻近况，通过独立 CTA 让 DeepSeek V4 Pro 根据心情与当地时间直接推荐饮品并生成不重复签语
- 心情推荐与下方手动选择饮品方向相互独立，手动选择不会携带便笺内容
- 首次点击时按需调用 MiniMax 生成温柔女声签语，当前签语内缓存并支持暂停、继续与重播
- 服务端可根据结构化饮品信息创建 Evolink 异步产品图任务并查询结果
- Evolink 两阶段宣传片后端：先把方形饮品图扩成 16:9 广告首帧，再生成 720p、5 秒视频
- 内置菜单资料来源与门店可售提示
- “随机灵感 / 自创一杯”双模式切换；自创模式仅登录用户可用
- 自创配方桌提供 40+ 项茶底、乳基底、鲜果、香气、小料和云顶选择，并校验数量、0 咖与高酸鲜乳等冲突
- 自创结果包含原创饮品名、风味摘要、标签、配料小票和祝福，明确标记为“AI 概念特调”
- 自创饮品图使用异步任务轮询、进度骨架和失败重试；完成后可继续制作 16:9、720p、5 秒宣传片
- 图片与视频标注约 24 小时有效，提供浏览器支持范围内的保存、打开和下载入口
- 模式切换、重新创作和组件卸载会终止旧请求、轮询及音视频，避免旧作品覆盖新结果

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
EVOLINK_API_KEY=你的 Evolink API Key
VIDEO_TASK_SIGNING_SECRET=随机长字符串
```

`VITE_` 开头的两个值是浏览器可用的公开服务地址。`NEON_AUTH_URL` 是同一个 Neon Auth 公开地址的服务端副本，用于定位 JWKS；本地未设置时会回退到 `VITE_NEON_AUTH_URL`，生产环境建议显式设置。`DATABASE_URL` 含数据库密码，只能放在本地或部署平台的服务端环境变量中，不能改名为 `VITE_DATABASE_URL`。

`DEEPSEEK_API_KEY`、`MINIMAX_API_KEY` 和 `EVOLINK_API_KEY` 都只能配置在服务端。浏览器请求同源的 `/api/recommendation`、`/api/blessing`、`/api/speech` 及自创饮品媒体 API，服务端再调用 `deepseek-v4-pro`、MiniMax `speech-2.8-hd` 和 Evolink `gpt-image-2-beta`，因此 Key 不会进入前端构建产物。语音只在用户点击播放后生成，MiniMax 返回的临时 URL 仅缓存于当前页面、当前签语；重新摇签会终止旧请求并清空音频。部署到 Vercel 时，同样需要配置这些服务端环境变量，以及用于 JWKS 验签的 `NEON_AUTH_URL`。

祝福接口会为当前签语签发短时播放凭证，语音接口只接受与该凭证匹配且不超过 120 字的文本；这个 HMAC 凭证与登录校验是两道独立检查。心情输入第一版只随本次请求发送，不写入账号数据库或本地存储。

### 多模态 API 鉴权契约

自创文本、音频、图片、视频生成及任务查询都使用同一套服务端鉴权，不能把隐藏或禁用前端按钮当成安全边界。当前浏览器协议是：

1. 请求前调用 `neonClient.auth.getSession()`，从 `data.session.token` 读取当前短期 JWT；token 只保留在 Neon Auth 的内存会话中，不写入 `localStorage`。
2. 向同源 API 添加 `Authorization: Bearer <token>`；前端 helper 会拒绝跨域目标，避免误把 token 发给第三方。
3. 服务端 `server/auth.mjs` 从 `NEON_AUTH_URL`（或回退的 `VITE_NEON_AUTH_URL`）加载 `/.well-known/jwks.json`，验证签名、`iss`、`aud`、`exp`；Neon 当前登录 JWT 的 `iss`/`aud` 是 Auth URL 的 origin，匿名 token 的 `iss` 可能使用完整 Auth URL，因此服务端只接受这两个同源 issuer，并始终要求 audience 为 origin。服务端要求 `role=authenticated` 并拒绝 Neon 匿名 token，只把验签后的 `sub` 作为用户 ID。请求体里的 `userId`、`email` 一律不可信。
4. 缺失、过期、伪造 token 统一返回 `401 AUTH_REQUIRED`；Auth URL 配置错误、JWKS 网络或服务异常统一返回 `503 AUTH_UNAVAILABLE`。

JWT 是 Neon Auth 签发的短期服务凭证（当前 Better Auth 默认约 15 分钟），服务端每次都校验其有效期。主动退出后，已经签发的 JWT 最迟会在自身 `exp` 到期时失效；本项目不持久化 token，以缩小暴露窗口。

实现依据是当前 `@neondatabase/neon-js` 的 `set-auth-jwt` 会话行为，以及 Better Auth 的 [JWT/JWKS 验证契约](https://better-auth.com/docs/plugins/jwt)。

Express 与 Vercel 的 `/api/create-custom-drink`、`/api/speech`、图片和视频 handler 均已接入同一个 guard；鉴权总是在限流和外部模型调用之前完成：

```js
import { requireAuthenticatedUser } from "./server/auth.mjs";

const auth = await requireAuthenticatedUser(request, response);
if (!auth) return;
// 这里只使用 auth.user.id；随后才限流并调用生成服务。
```

这段接口同时兼容 Express 的 `request/response` 和 Vercel Node handlers；测试时也可以向 `authenticateRequest` 注入本地 JWKS key set，不需要绕过生产验证逻辑。

## Evolink 饮品宣传片后端

宣传片严格分为两个异步阶段，不能跳过第一阶段后把 1:1 原图直接交给视频模型：

1. `POST /api/generate-video-frame` 使用固定的 `gpt-image-2-beta`、`size: "16:9"`、`resolution: "1K"`，对已完成的方形饮品图做编辑与扩图。
2. 浏览器用 `GET /api/video-task` 查询首帧任务；完成后取得 `resultUrl`。
3. `POST /api/generate-drink-video` 使用该 16:9 首帧，固定调用 `happyhorse-1.1-image-to-video`、`quality: "720p"`、`duration: 5`。视频请求不发送 `aspect_ratio`，比例继承首帧。
4. 浏览器继续查询视频任务，并在完成后尽快保存 `resultUrl`；Evolink 视频结果地址仅临时有效。

两个创建接口都只接受以下业务字段，不接受客户端覆盖模型、画幅、清晰度、时长、回调地址或用户身份：

```json
{
  "imageUrl": "https://cdn.your-domain.com/drink.png",
  "drink": {
    "name": "多肉葡萄",
    "category": "果茶",
    "summary": "葡萄果肉与清爽茶底",
    "layers": ["葡萄果肉", "绿妍茶汤", "芝士云顶"]
  },
  "moodNote": "今天终于完成了一个重要项目，很轻松。"
}
```

第二阶段把 `imageUrl` 改为 `frameUrl`。URL 必须是可公开解析的 HTTPS 地址；服务端会限制字段、文本长度，并拒绝本地、内网、保留地址和未知参数。

Evolink 生成结果使用官方 `files.evolink.ai` 临时媒体域名。部分本地代理会把该域名解析到 `198.18.0.0/15` 的 Fake-IP 保留网段，因此服务端仅对这个精确官方域名跳过 DNS 公网性检查；相似后缀、其他域名、IP 地址及本地/内网/保留地址仍会被拒绝。

创建成功返回 HTTP 202：

```json
{
  "taskId": "task-unified-...",
  "taskType": "image",
  "stage": "frame",
  "status": "pending",
  "progress": 0,
  "resultUrl": null,
  "pollToken": "短期签名查询凭证",
  "pollAfterMs": 2500
}
```

查询方式为 `GET /api/video-task?taskId=...&taskType=image&pollToken=...`。状态统一为 `pending`、`processing`、`completed`、`failed` 或 `cancelled`；终态的 `pollAfterMs` 为 `null`。首帧完成后返回 `taskType: "image"`、`stage: "frame"`，视频完成后返回 `taskType: "video"`、`stage: "video"`。

所有视频接口默认直接调用 `server/auth.mjs` 验证 Neon JWT；测试或基础设施也可以通过 `createVideoRouter({ authGuard })` 及 Vercel 文件导出的 `createHandler({ authGuard })` 注入等价 guard。请求体中的 `userId` 会被当作未知字段拒绝。轮询凭证用 `VIDEO_TASK_SIGNING_SECRET`（未配置时回退到服务端 Evolink Key）签名并绑定已验证主体，不能跨账号查询。

便于其他分支直接复用的底层契约位于 `server/video.mjs`：

```js
createVideoFrameTask({ imageUrl, drink, moodNote }, apiKey, options)
createVideoTask({ frameUrl, drink, moodNote }, apiKey, options)
queryTask(taskId, "image" | "video", apiKey, options)
```

`options` 只用于服务端测试或基础设施注入（如 `fetchImpl`、DNS lookup 和请求超时），不会从 HTTP 请求透传。

自创饮品文本由 `POST /api/create-custom-drink` 提供。服务端只把经过长度与结构清洗的配料/心情放入 user message，使用严格 JSON 输出并在格式异常时安全回落；图片与视频描述由服务端模板结合已审核的饮品文案构造，不会把用户文本作为 system instruction。前端媒体 adapter 预留以下集成契约：

- `POST /api/generate-drink-image` → `{ taskId, pollToken }`
- `GET /api/media-task?taskId=...&pollToken=...` → `{ status, progress, results? }`
- `POST /api/generate-video-frame` → `{ taskId, taskType, pollToken }`（扩展 16:9 首帧）
- `GET /api/video-task?taskId=...&taskType=...&pollToken=...` → `{ status, progress, resultUrl? }`
- `POST /api/generate-drink-video` → `{ taskId, taskType, pollToken }`（720p、5 秒）

所有自创生成请求都会通过同源 auth fetch helper 在每次请求前重新读取当前 session JWT，并发送 `Authorization: Bearer <session token>`；服务端对缺失、伪造、过期或匿名 token 均拒绝。图片和视频查询凭证还会额外绑定任务、类型和已验证用户。

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

## 饮品图片异步 API

Express 开发服务器和 Vercel Functions 提供相同的两个端点。所有响应（包括错误）都带 `Cache-Control: no-store`；错误使用中文安全文案，不转发 Evolink 的原始错误详情。上游字段约束以 [Evolink GPT Image 2 Beta 官方文档](https://evolink.ai/docs/cn/api-manual/image-series/gpt-image-2/gpt-image-2-beta-image-generation) 为准。

### 创建任务

`POST /api/generate-drink-image`

请求体只接受结构化字段，不接受 `prompt` 或其他额外字段：

```json
{
  "name": "晚霞葡萄气泡茶",
  "ingredients": ["葡萄果肉", "茉莉茶汤", "气泡水"],
  "moodNote": "庆祝今天完成了一件难事",
  "colorFlavor": "紫粉渐变，酸甜清爽"
}
```

- `name`：必填，最多 40 字。
- `ingredients`：必填，1–12 项，每项最多 36 字。
- `moodNote`：可选，用户心情或一句话，最多 120 字。
- `colorFlavor`：可选，颜色与风味描述，最多 180 字。

服务端把这些字段作为不可信素材标签嵌入固定模板，不执行字段内的指令。Evolink 请求固定使用 `gpt-image-2-beta`、`size: "1:1"`、`resolution: "1K"` 和 `n: 1`。成功时返回 HTTP 202：

```json
{
  "taskId": "task-unified-...",
  "status": "pending",
  "progress": 0,
  "results": []
}
```

### 查询任务

`GET /api/media-task?taskId=task-unified-...&pollToken=...`

返回 HTTP 200。`status` 为 `pending`、`processing`、`completed` 或 `failed`；完成后 `results` 含唯一的 HTTPS 图片地址，失败时包含中文 `error`。结果 URL 由 Evolink 托管且仅约 24 小时有效，消费方应及时转存，不能把它当永久资源。

### 认证与限流集成

两个 handler 默认复用 `server/auth.mjs` 的 Neon JWKS 验签，也允许测试注入等价的 `authenticateRequest(request)`。接口从不信任请求体或查询参数中的 `userId`。创建任务返回的 `pollToken` 由服务端签名并绑定任务与已验证用户；换账号查询会返回 403，缺少登录则返回 401。

默认内存限流同时按已认证用户和 IP 计数：创建任务每 10 分钟每用户 8 次、每 IP 16 次；查询每 10 分钟每用户 120 次、每 IP 240 次。它适合单进程开发环境；多实例 Vercel 部署应把 handler 的 `rateLimiter` 注入替换成带异步 `consume({ action, userId, ip })` 的共享存储实现，以获得全局限流。

> 本项目不是喜茶官方产品。饮品、原料及可选项以喜茶小程序和门店当日页面为准。

## 测试

服务端单元测试与生产构建：

```bash
npm test
npm run build
```

Playwright mock 验收使用测试构建专用的内存会话注入；常规 `npm run build` 会在编译期移除该入口。先生成一次测试构建并启动，再运行浏览器脚本：

```bash
VITE_QA_SESSION=true npm run build
PORT=4173 npm start
# 另一个终端
npm run test:e2e
```

脚本覆盖未登录门禁、登录创作、配料限制、心情请求、图片轮询与失败重试、语音、视频两阶段、Bearer header、竞争取消、桌面截图、390px 截图、横向溢出和控制台错误。
