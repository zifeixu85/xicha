# 喜点什么？

一个从“今天喝什么”出发的多模态 AI 饮品创作 Demo：它可以随机推荐饮品，根据用户心情生成签语和配料建议，并为登录用户生成祝福语音、原创饮品图与 5 秒宣传片。

> [!IMPORTANT]
> 这是 **UXPA / UXDA AI 设计智能体线下课程的课堂产品代码**，用于演示如何从一个可运行的网页原型，逐步加入大模型、语音、图片、视频、登录、数据库和对象存储。它不是喜茶官方产品，也不建议未经安全、费用和内容审核就直接作为生产服务开放。

课堂完整复盘：[从随机奶茶到会理解心情的多模态 AI 饮品产品](https://my.feishu.cn/wiki/UpuAwUEVNiBNnHk3XtrcLx0VnPe)

线上课堂 Demo：[https://xicha-opal.vercel.app](https://xicha-opal.vercel.app)

> [!NOTE]
> 线上 Demo 是费用安全的课堂展示版：可以查看完整样式与交互，注册 / 登录，并使用 DeepSeek 生成签语、心情推荐、配料建议和自创饮品文案；图片、视频、音频生成暂时冻结。完整多模态能力请把本仓库交给 AI 编程助手，让它在你的电脑上运行，再配置你自己的 API。

## 你可以怎样使用这份代码

- 只想学习前端交互：不配置第三方 API 也可以启动项目，浏览随机饮品、筛选和基础页面。
- 想体验 AI 签语和心情推荐：配置 DeepSeek API。
- 想体验语音、图片和视频：还需要 MiniMax、Evolink，并配置 Neon 登录。
- 想保存用户作品：继续配置 Neon PostgreSQL 与 Cloudflare R2。
- 想部署到线上：把所有服务端密钥放在部署平台的环境变量中，并设置正式域名、限流和费用预警。

## 最省事的本地使用方式：把任务交给 AI

不熟悉 Git 或命令行也没关系。打开 Codex、Claude Code、Cursor 等可以操作本机文件与终端的 AI 编程助手，把下面整段提示词发给它：

```text
请帮我在本机运行这个课堂项目：https://github.com/zifeixu85/xicha

请你直接完成克隆、安装、配置检查、测试和启动，不要只给我教程。要求：
1. 先检查 Node.js 是否满足 20.19+ 或 22.12+，不满足时告诉我最安全的安装方式。
2. 把仓库克隆到一个新的 xicha 文件夹；如果已经存在，先检查状态，不要覆盖我的文件。
3. 阅读 README.md、package.json 和 .env.example，然后执行 npm install。
4. 复制 .env.example 为仅在本机使用的 .env；不要把任何密钥写进源码、聊天回复或 Git 提交。
5. 先不配置付费 API，执行 npm test、npm run build 和 npm run dev，确认基础界面可运行。
6. 把本地访问地址发给我。如果出错，请继续排查并修复到可以打开为止。
7. 接着问我想启用哪一种能力：DeepSeek 文本、Neon 登录、MiniMax 语音、Evolink 图片/视频、Cloudflare R2 存储。一次只启用一种，只向我索取当前必需的配置。
8. 只有我确认 Neon 已准备好后才执行 npm run db:migrate；不要替我创建付费资源或公开部署。
9. 每完成一种能力，都实际测试一次，并用产品效果而不是代码术语告诉我结果。
```

这段提示词的目标不是让 AI “教你敲命令”，而是让它成为你的本地搭建助手。你只需要决定要什么产品能力，并从对应平台创建自己的账号和密钥。

## 手动本地快速开始（给熟悉命令行的同学）

### 1. 准备环境

- Node.js `20.19+` 或 `22.12+`
- npm
- Git

### 2. 安装与启动

```bash
git clone https://github.com/zifeixu85/xicha.git
cd xicha
npm install
cp .env.example .env
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。开发服务器会同时提供 Vite 页面与同源 API。

如果只查看基础随机页面，可以暂时不填写 `.env`。未配置的 AI、登录与媒体功能会不可用或返回明确的配置错误，不会自动使用仓库作者的账号和额度。

### 3. 生产构建与本地预览

```bash
npm run build
npm run preview
```

可用 `PORT=4173 npm run preview` 指定端口。

生产构建默认进入线上课堂演示模式，因此 `npm run preview` 会冻结图片、视频和音频。要在受控的私有部署中启用完整媒体能力，需要显式设置 `VITE_PUBLIC_DEMO_MODE=false`，并配置相应服务端密钥；日常本地完整体验请直接使用 `npm run dev`。

## 线上 Demo 的安全边界

当前代码在前端与服务端都冻结了线上媒体功能。生产环境和 Vercel 默认启用课堂演示模式，即使有人绕过按钮直接请求 API，也会得到 `403 PUBLIC_DEMO_MEDIA_DISABLED`，不会调用付费媒体模型。

Vercel 中建议保留：

- `DEEPSEEK_API_KEY`：文本签语、心情推荐、配料建议与自创文案。
- `VITE_NEON_AUTH_URL`、`VITE_NEON_DATA_API_URL`、`NEON_AUTH_URL`：注册、登录与鉴权。
- `DATABASE_URL`：自创文本作品和用户数据需要数据库时保留。
- 可选设置 `VITE_PUBLIC_DEMO_MODE=true`：把当前部署意图写得更明确；不设置时生产环境也默认冻结。

Vercel 中可以删除或禁用：

- `MINIMAX_API_KEY`
- `EVOLINK_API_KEY`
- `VIDEO_TASK_SIGNING_SECRET`
- `STORAGE_ENDPOINT`、`STORAGE_REGION`、`STORAGE_ACCESS_KEY`、`STORAGE_SECRET_KEY`、`STORAGE_BUCKET`、`STORAGE_DOMAIN`

所以不建议“只留下 DeepSeek”。如果还要注册登录，Neon 的公开地址、服务端鉴权地址以及实际使用到的数据库连接仍应保留。删掉媒体变量是控制费用的第二道保险，代码中的服务端开关才是防止接口被直接调用的第一道边界。

## 需要哪些 API 产品

下面的服务都需要使用你自己的账号、密钥和额度。模型名称、价格和权限可能调整，请以各平台当前控制台及官方文档为准。

| 产品 | 在本项目中的用途 | 是否必需 | 官方入口 |
|---|---|---|---|
| DeepSeek API | 随机签语、按心情推荐、自创饮品文案、AI 配料建议 | AI 文本功能必需 | [API 文档](https://api-docs.deepseek.com/zh-cn/) |
| MiniMax 开放平台 | 把祝福语合成为 MP3 语音 | 语音播放必需 | [同步语音合成](https://platform.minimaxi.com/docs/api-reference/speech-t2a-http) |
| Evolink.ai | 生成 1:1 饮品图、扩展 16:9 首帧、生成 720p / 5 秒视频 | 图片和视频必需 | [GPT Image 2](https://evolink.ai/docs/cn/api-manual/image-series/gpt-image-2/gpt-image-2-beta-image-generation) · [HappyHorse 1.1](https://evolink.ai/docs/cn/api-manual/video-series/happyhorse1.1/happyhorse-1.1-image-to-video) |
| Neon | 邮箱登录、JWT/JWKS 鉴权、收藏、作品记录和 PostgreSQL | 登录与用户数据必需 | [Neon 文档](https://neon.com/docs/introduction) |
| Cloudflare R2 | 长期保存图片、音频和视频，避免供应商临时链接过期 | 作品媒体保存必需 | [S3 兼容 API 入门](https://developers.cloudflare.com/r2/get-started/s3/) |

项目当前按课堂需求固定使用 `deepseek-v4-pro`、MiniMax `speech-2.8-hd`、Evolink `gpt-image-2-beta` 与 `happyhorse-1.1-image-to-video`。如果你的账号没有对应模型权限，请先在供应商控制台确认可用模型，再修改服务端常量；不要让浏览器传入任意模型名。

### 推荐的配置顺序

1. 先不配置 API，确认基础页面可以运行。
2. 配置 `DEEPSEEK_API_KEY`，测试签语与心情推荐。
3. 配置 Neon Auth、Data API 和 `DATABASE_URL`，运行数据库迁移并测试两个账号的数据隔离。
4. 配置 `MINIMAX_API_KEY`，测试登录后的语音播放。
5. 配置 `EVOLINK_API_KEY` 与任务签名密钥，先测试图片，再测试视频，避免一次产生过多费用。
6. 最后配置私有 Cloudflare R2 桶，让生成媒体进入用户作品记录。

> [!WARNING]
> 不要把真实 API Key 写入源码、README、截图、课堂群聊、录屏或 Git 提交。只写入被忽略的 `.env`，线上写入部署平台的服务端环境变量。任何曾经公开展示过的测试密钥都应该撤销并重新生成。

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
- 自创配方桌支持“自己挑配料 / AI 按心情搭配”双路径；心情模式只从配料白名单选择，自动填入抽屉后仍可手动微调
- 自创结果包含原创饮品名、风味摘要、标签、配料小票和祝福，明确标记为“AI 概念特调”
- 自创饮品图使用异步任务轮询、进度骨架和失败重试；完成后可继续制作 16:9、720p、5 秒宣传片
- 自创饮品完成后的图片、祝福语音与视频自动转存到 Cloudflare R2，并按登录账号归档
- 模式切换、重新创作和组件卸载会终止旧请求、轮询及音视频，避免旧作品覆盖新结果

## 完整功能配置

### 环境变量速查

| 环境变量 | 从哪里获得 | 用途 |
|---|---|---|
| `VITE_PUBLIC_DEMO_MODE` | 自己设置 `true` / `false` | 显式冻结或开放媒体功能；生产环境默认冻结 |
| `DEEPSEEK_API_KEY` | DeepSeek 开放平台 | 文本签语、推荐和自创饮品 |
| `MINIMAX_API_KEY` | MiniMax 开放平台 | 祝福语音 |
| `EVOLINK_API_KEY` | Evolink.ai | 图片、首帧和视频任务 |
| `VITE_NEON_AUTH_URL` | Neon Auth | 浏览器登录入口 |
| `VITE_NEON_DATA_API_URL` | Neon Data API | 浏览器收藏数据访问 |
| `NEON_AUTH_URL` | 与 Auth URL 相同 | 服务端读取 JWKS 并校验 JWT |
| `DATABASE_URL` | Neon 项目连接信息 | 数据库迁移与作品记录读写 |
| `VIDEO_TASK_SIGNING_SECRET` | 自己生成 | 为图片/视频轮询凭证签名 |
| `STORAGE_ENDPOINT` | Cloudflare R2 | S3 兼容 API 地址 |
| `STORAGE_ACCESS_KEY` | Cloudflare R2 API Token | R2 Access Key ID |
| `STORAGE_SECRET_KEY` | Cloudflare R2 API Token | R2 Secret Access Key |
| `STORAGE_BUCKET` | 自己创建的 R2 桶 | 保存生成媒体 |

生成本地任务签名密钥：

```bash
openssl rand -base64 32
```

### Neon 登录、数据库与用户数据

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
STORAGE_ENDPOINT=https://你的账号ID.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY=你的 R2 Access Key ID
STORAGE_SECRET_KEY=你的 R2 Secret Access Key
STORAGE_BUCKET=你的私有桶名
STORAGE_DOMAIN=可选的自定义媒体域名
DEEPSEEK_API_KEY=你的 DeepSeek API Key
MINIMAX_API_KEY=你的 MiniMax API Key
EVOLINK_API_KEY=你的 Evolink API Key
VIDEO_TASK_SIGNING_SECRET=随机长字符串
```

`VITE_` 开头的两个值是浏览器可用的公开服务地址。`NEON_AUTH_URL` 是同一个 Neon Auth 公开地址的服务端副本，用于定位 JWKS；本地未设置时会回退到 `VITE_NEON_AUTH_URL`，生产环境建议显式设置。`DATABASE_URL` 含数据库密码，只能放在本地或部署平台的服务端环境变量中，不能改名为 `VITE_DATABASE_URL`。

`DEEPSEEK_API_KEY`、`MINIMAX_API_KEY`、`EVOLINK_API_KEY` 和 `STORAGE_*` 都只能配置在服务端。浏览器请求同源 API，服务端调用模型并把完成的自创媒体立即转存到 R2，因此所有 Key 都不会进入前端构建产物。作品记录只保存 R2 对象键，读取时先验证 Neon 登录账号，再签发 15 分钟有效的 GET 地址。不要使用公开的 `r2.dev` 域名作为权限控制；正式使用时应关闭桶的公开开发 URL。

祝福接口会为当前签语签发短时播放凭证，语音接口只接受与该凭证匹配且不超过 120 字的文本；这个 HMAC 凭证与登录校验是两道独立检查。随机摇签的心情只随本次请求发送；自创饮品的心情会作为该账号作品记录的一部分保存。

### 3. 配置 Cloudflare R2

1. 在 Cloudflare 控制台进入 **R2 Object Storage**，创建一个私有桶。
2. 创建只作用于该桶的 **Object Read & Write** API Token。
3. 保存 Access Key ID、Secret Access Key 和 S3 API Endpoint；Secret 通常只显示一次。
4. 把这些值写入本地 `.env` 的 `STORAGE_*` 字段。
5. 不要依赖公开 `r2.dev` 地址做用户权限控制。项目会在服务端验证登录用户并签发短时 GET URL。

R2 的 S3 Endpoint 格式通常为：

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

详细步骤见 [Cloudflare R2 S3 API 入门](https://developers.cloudflare.com/r2/get-started/s3/) 和 [R2 API Token](https://developers.cloudflare.com/r2/api/tokens/)。

### 4. 执行数据库迁移

确保已经开启 Neon Auth，并配置好 `DATABASE_URL`：

```bash
npm run db:migrate
```

迁移脚本会依次执行 `migrations/` 下的 SQL，创建收藏表、作品表与媒体表，并配置按 `auth.user_id()` 隔离的 RLS 策略。

### 5. 启动并验证账号隔离

```bash
npm run dev
```

注册两个测试账号，分别收藏或创作不同饮品；互相登录时不应看到对方的数据。部署到 Vercel 等平台时，需要配置两个 `VITE_NEON_*` 环境变量、`NEON_AUTH_URL` 和 `DATABASE_URL`，并将正式域名加入 Neon Auth Allowed origins。`DATABASE_URL` 既用于迁移，也用于作品记录和媒体元数据的服务端读写。

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
4. 浏览器继续查询视频任务；完成后服务端把临时结果转存至 R2，并将对象关联到当前账号的作品记录。

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

返回 HTTP 200。`status` 为 `pending`、`processing`、`completed` 或 `failed`；带有 `creationId` 的自创任务完成后，服务端会先将图片转存到 R2，再在 `results` 中返回短时签名读取地址。

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
