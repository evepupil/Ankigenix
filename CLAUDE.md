# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Ankigenix - AI-Powered Flashcard Generation Platform

## 1. 项目概况

- **产品名称**: Ankigenix
- **目标**: 构建一个多源输入的 AI 闪卡生成平台
- **核心体验**: 输入内容（文本/文件/链接/视频） → 异步处理 → 生成知识卡片 → 复习/导出
- **部署环境**: Vercel (Pro Plan) + Neon (DB) + Cloudflare R2 (Storage)

---

## 2. Tech Stack & Requirements

请基于以下技术栈进行开发，不要使用过时的库：

### 核心框架
| 类别 | 技术 |
|------|------|
| **全栈框架** | Next.js 15 (App Router, Turbopack) |
| **语言** | TypeScript (Strict Mode, no `any`), React 19 |
| **样式** | Tailwind CSS 4, Shadcn/UI, Radix UI, Framer Motion |
| **数据库** | PostgreSQL (Neon), Drizzle ORM (Edge compatible) |
| **认证** | Better Auth |
| **验证** | Zod, React Hook Form, next-safe-action |

### Ankigenix 特定依赖
| 类别 | 技术 | 用途 |
|------|------|------|
| **异步队列** | **Inngest** | 核心组件，解决 Vercel 60秒超时限制 |
| **存储** | Cloudflare R2 / AWS S3 | 用户上传文件存储 |
| **AI/LLM** | OpenAI (gpt-4o-mini) 或 Anthropic (Claude 3.5 Haiku) | 闪卡生成（推荐小模型降低成本） |
| **URL解析** | Jina Reader API | 网页内容提取 (`https://r.jina.ai/`) |
| **视频解析** | youtube-transcript | YouTube 字幕提取 |
| **文件解析** | pdf-parse, mammoth | PDF/Word 文本提取 |
| **支付** | Stripe | 订阅和一次性购买 |
| **限流** | Upstash Redis | API 滥用防护 |
| **导出** | apkg-generator | Anki 格式导出 |

### 工具链
- **Linting/Formatting**: Biome
- **Package Manager**: pnpm
- **State Management**: Zustand, TanStack Query (仅必要时)
- **文档**: Fumadocs
- **图标**: Lucide React

---

## 3. Commands

```bash
pnpm dev          # 启动开发服务器 (Turbopack)
pnpm build        # 生产构建
pnpm start        # 启动生产服务器
pnpm lint         # Biome 代码检查
pnpm format       # Biome 格式化
pnpm check        # Biome 检查并自动修复
pnpm typecheck    # TypeScript 类型检查
pnpm db:push      # 推送 Schema 到数据库
pnpm db:studio    # 打开 Drizzle Studio
pnpm test         # 运行测试
```

---

## 4. Architecture

### Route Groups
- `(marketing)` - 公开营销页面 (Header + Footer 布局)
- `(dashboard)` - 需认证的仪表盘 (Sidebar + Topbar 布局)
- `(auth)` - 认证页面 (登录/注册/重置密码)

### Feature-based 结构
每个功能模块在 `src/features/` 下独立组织：
```
src/features/[name]/
├── components/     # UI 组件
├── actions/        # Server Actions
├── hooks/          # 自定义 Hooks
├── types/          # 类型定义
└── index.ts        # 导出
```

### 路径别名
使用 `@/*` 指向 `src/*`，例如 `@/components/ui`。

---

## 5. 核心功能技术实现

### 5.1 异步处理架构 (The Async Pipeline)

**关键**: 所有生成请求不直接返回结果，而是返回任务 ID。

```
┌─────────┐    ┌──────────────┐    ┌─────────┐    ┌──────────┐
│ Frontend │───▶│ Server Action │───▶│ Inngest │───▶│ LLM/Parser│
│          │    │ Create Task  │    │ Queue   │    │          │
└─────────┘    └──────────────┘    └─────────┘    └──────────┘
     │                │                  │              │
     │                ▼                  ▼              ▼
     │         Return taskId      Process Task    Save to DB
     │                                                  │
     ▼                                                  ▼
  Poll /api/tasks/[id] ◀────────────────────────── COMPLETED
```

**流程**:
1. 前端提交表单 → Server Action 创建 `Task` (Status: PENDING) → `inngest.send()` → 返回 `taskId`
2. Inngest 接收事件 → 执行 `processFlashcardGeneration` (后台长时运行)
3. 前端使用 `useSWR` 每3秒轮询 `/api/tasks/[id]`，直到状态变为 `COMPLETED`

### 5.2 输入源解析策略

| 输入类型 | 解析方案 | 限制 |
|----------|----------|------|
| **文本** | 直接传入 Prompt | 免费 1k 字符，Pro 10k 字符 |
| **URL** | Jina Reader API (`fetch('https://r.jina.ai/' + url)`) | 获取清洁 Markdown |
| **文件** | 上传至 R2 → `pdf-parse` / `mammoth` 提取文本 | MVP 仅支持纯文本提取 |
| **视频** | `youtube-transcript` 获取字幕 | 无字幕则报错提示 |

### 5.3 Inngest 函数配置示例

```typescript
// src/inngest/functions.ts
export const generateCards = inngest.createFunction(
  {
    id: "generate-cards",
    concurrency: {
      limit: 10,                        // 全局并发限制
      key: "event.data.plan"            // 基于套餐隔离队列
    },
    priority: {
      run: "event.data.plan === 'pro'"  // Pro 用户优先调度
    }
  },
  { event: "app/generate" },
  async ({ event, step }) => {
    // Step 1: 验证积分
    // Step 2: 解析输入源
    // Step 3: 调用 LLM 生成闪卡
    // Step 4: 保存到数据库
  }
);
```

### 5.4 LLM Prompt 输出格式

确保 LLM 以 JSON Mode 稳定输出：
```json
[
  { "front": "问题/概念", "back": "答案/解释" },
  { "front": "...", "back": "..." }
]
```

---

## 6. Database Schema (新增表)

在现有 schema 基础上添加：

```typescript
// src/db/schema.ts

// 牌组 (Deck)
export const deck = pgTable("deck", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  cardCount: integer("card_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 闪卡 (Card)
export const card = pgTable("card", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  deckId: text("deck_id").notNull().references(() => deck.id, { onDelete: "cascade" }),
  front: text("front").notNull(),           // 正面内容
  back: text("back").notNull(),             // 背面内容
  sourceType: text("source_type").notNull(), // text | url | file | video
  sourceRef: text("source_ref"),            // 原始来源引用
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 生成任务 (Task)
export const task = pgTable("task", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  deckId: text("deck_id").references(() => deck.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  sourceType: text("source_type").notNull(),           // text | url | file | video
  sourceContent: text("source_content"),               // 原始输入内容
  sourceUrl: text("source_url"),                       // 文件URL或网页URL
  errorMessage: text("error_message"),                 // 失败原因
  cardCount: integer("card_count").default(0),         // 生成的卡片数
  creditsCost: integer("credits_cost").notNull(),      // 消耗积分
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
```

---

## 7. 付费与增长策略

### 7.1 积分消耗规则

| 输入类型 | 消耗积分 |
|----------|----------|
| Text | 1 Credit |
| URL | 3 Credits |
| File | 3 Credits |
| Video | 5 Credits |

**实现**: 在 Inngest 函数开始前，使用 Drizzle 事务扣除积分，不足则抛错。

### 7.2 邀请机制

- 用户注册时生成 NanoID 作为 `referralCode`
- 新用户填写邀请码 → 查找邀请人 → 事务更新双方 `credits + 20`

---

## 8. API Routes

### 需要新增的 API 路由

```
src/app/api/
├── inngest/route.ts           # Inngest webhook endpoint
├── tasks/[id]/route.ts        # 任务状态查询 (GET)
├── export/
│   ├── apkg/route.ts          # 导出 .apkg 格式
│   └── markdown/route.ts      # 导出 .md 格式
└── upload/
    └── presigned/route.ts     # 获取 R2/S3 预签名 URL
```

---

## 9. 开发路线图

### 阶段一：地基搭建
1. [x] 数据库: Neon PG + Drizzle Schema (User, 已有)
2. [ ] 数据库: 添加 Deck, Card, Task 表
3. [x] 认证: Better Auth (Google/Email)
4. [x] UI 布局: Dashboard 侧边栏

### 阶段二：核心引擎 (The Engine) - *最关键*
1. [ ] Inngest 集成: 配置 `/api/inngest` 路由
2. [ ] 纯文本流程: Text Input → LLM (JSON Mode) → Save to DB
3. [ ] 前端轮询: 使用 useSWR 轮询任务状态
4. [ ] Prompt 调试: 确保稳定输出 `[{front, back}]`

### 阶段三：多源输入
1. [ ] URL 解析: 集成 Jina Reader API
2. [ ] 文件上传: R2/S3 + pdf-parse + mammoth
3. [ ] 视频解析: youtube-transcript

### 阶段四：管理与导出
1. [ ] 牌组 CRUD: 创建/编辑/删除牌组
2. [ ] 卡片 CRUD: 增删改查卡片，支持移动到不同牌组
3. [ ] 导出功能: .apkg 和 .md 格式

### 阶段五：商业化
1. [ ] Stripe: Checkout + Webhook
2. [ ] 积分限制: Server Action 入口检查
3. [ ] Redis 限流: Upstash 防止 API 滥用

---

## 10. Coding Standards

- **App Router Only**: 严禁使用 `pages/` 目录
- **Server Components**: 默认使用 RSC，只有需要交互时才添加 `'use client'`
- **Data Fetching**: Server Components 中直接调用 DB/Drizzle
- **Server Actions**: 所有变异操作使用 Server Actions + `next-safe-action`
- **Type Safety**: 所有 Props、API 响应、DB Schema 必须有完整类型定义
- **Error Handling**: 使用 Zod 验证输入，返回友好错误信息

---

## 11. Environment Variables (新增)

```bash
# Inngest
INNGEST_EVENT_KEY=           # Inngest 事件密钥
INNGEST_SIGNING_KEY=         # Inngest 签名密钥

# AI/LLM
OPENAI_API_KEY=              # OpenAI API 密钥
# 或
ANTHROPIC_API_KEY=           # Anthropic API 密钥

# Jina Reader (可选，免费使用)
JINA_API_KEY=                # Jina Reader API 密钥 (提升限额)
```

---

## 12. TODO (Known Issues)

- [ ] **Google OAuth 登录报错 `invalid_code`** - 配置看起来正确，但回调时返回无效代码错误
- [ ] **GitHub OAuth 登录报错 `unable_to_get_user_info`** - 可能是 GitHub 邮箱隐私设置问题

---

## 13. Project Structure (Updated)

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/
│   │   ├── (marketing)/    # 公开页面
│   │   ├── (auth)/         # 认证页面
│   │   ├── (dashboard)/    # 用户仪表盘
│   │   │   └── dashboard/
│   │   │       ├── decks/          # 牌组管理
│   │   │       ├── generate/       # 生成闪卡
│   │   │       └── settings/       # 用户设置
│   │   └── (admin)/        # 管理后台
│   └── api/
│       ├── inngest/        # Inngest webhook
│       ├── tasks/          # 任务状态
│       └── export/         # 导出功能
├── features/
│   ├── flashcards/         # 🆕 闪卡核心功能
│   │   ├── components/     # 闪卡相关组件
│   │   ├── actions/        # 生成/管理 Actions
│   │   └── hooks/          # useSWR 轮询等
│   ├── decks/              # 🆕 牌组管理
│   └── ...existing...
├── inngest/                # 🆕 Inngest 函数定义
│   ├── client.ts           # Inngest 客户端
│   └── functions.ts        # 后台处理函数
├── db/
│   └── schema.ts           # 数据库 Schema (含新表)
└── lib/
    ├── ai/                 # 🆕 LLM 调用封装
    ├── parsers/            # 🆕 内容解析器
    │   ├── jina.ts         # URL 解析
    │   ├── pdf.ts          # PDF 解析
    │   ├── word.ts         # Word 解析
    │   └── youtube.ts      # YouTube 字幕
    └── ...existing...
```
