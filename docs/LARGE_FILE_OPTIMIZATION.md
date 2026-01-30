# Large File Flashcard Generation Optimization

> 大文件闪卡生成优化方案

## Overview

针对大型 PDF 文件（100+ 页）的闪卡生成优化，采用**两阶段交互**模式：先生成大纲让用户选择范围，再按需并行生成闪卡。

## Problem Statement

当前实现的问题：

| 问题 | 影响 |
|------|------|
| 整个 PDF 文本一次性发给 LLM | 超大文件可能超出 context 限制 |
| 无内容筛选 | 浪费积分在不需要的内容上 |
| 单次生成卡片数有限 (max_tokens: 4096) | 大文件只能生成 ~30 张卡 |
| 无处理进度 | 用户体验差 |

## Solution Architecture

### Two-Phase Flow

```
Phase A: Document Analysis (Low cost, Fast)
┌──────────────────────────────────────────────┐
│ 1. Upload PDF                                │
│ 2. Extract text + Count tokens               │
│ 3. Send full text to LLM (if ≤128k)         │
│    OR chunk summary (if >128k)               │
│ 4. Generate document outline with chapters   │
│ 5. Display outline for user selection        │
└──────────────────────────────────────────────┘

Phase B: Selective Generation (On-demand, Parallel)
┌──────────────────────────────────────────────┐
│ 1. User selects chapters to generate         │
│ 2. Extract selected chapters' text           │
│ 3. Split into ~3500 token chunks             │
│ 4. Parallel LLM calls for each chunk         │
│ 5. Merge + Deduplicate cards                 │
│ 6. Save deck                                 │
└──────────────────────────────────────────────┘
```

### User Experience Flow

```
Step 1: Upload
┌─────────────────────────────────────────┐
│  📄 machine-learning.pdf (120p, 8.5MB)  │
│  ✅ Uploaded                            │
└─────────────────────────────────────────┘

Step 2: Analyzing... ⏳

Step 3: Select Chapters
┌─────────────────────────────────────────┐
│ ☑ Ch1: Introduction (p1-15)      ~8k   │
│ ☑ Ch2: Linear Regression (p16-40) ~15k │
│ ☐ Ch3: Classification (p41-70)   ~18k  │
│ ☐ Ch4: Neural Networks (p71-100) ~20k  │
│ ☐ Ch5: Deep Learning (p101-120)  ~14k  │
├─────────────────────────────────────────┤
│ Selected: 2 chapters (~23k tokens)      │
│ Estimated: ~30 cards | 3 credits        │
│                                         │
│ [Generate Selected Chapters]            │
└─────────────────────────────────────────┘
```

## Technical Specification

### Data Structures

```typescript
// Document outline (stored in generationTask.documentOutline)
interface DocumentOutline {
  totalPages: number;
  totalTokens: number;
  chapters: ChapterInfo[];
}

interface ChapterInfo {
  index: number;           // Chapter index
  title: string;           // Chapter title
  startPage: number;       // Start page
  endPage: number;         // End page
  estimatedTokens: number; // Estimated token count
  summary?: string;        // 1-sentence summary
  textRange: {             // Character offsets in full text
    start: number;
    end: number;
  };
}
```

### Database Schema Changes

```sql
-- generationTask table extensions
ALTER TABLE generation_task ADD COLUMN document_outline JSONB;
ALTER TABLE generation_task ADD COLUMN document_text TEXT;        -- Cached full text
ALTER TABLE generation_task ADD COLUMN selected_chapters INTEGER[];
ALTER TABLE generation_task ADD COLUMN total_chunks INTEGER;
ALTER TABLE generation_task ADD COLUMN completed_chunks INTEGER DEFAULT 0;
```

### Task Status Flow

```
Current:
  pending → processing → completed/failed

Extended:
  pending → analyzing → outline_ready → generating → completed/failed
              ↓              ↓
           (error)    (user selects chapters)
```

### Inngest Functions

#### analyzeDocument

Event: `flashcard/analyze-document`

```typescript
{
  taskId: string;
  userId: string;
  sourceUrl: string;
  sourceFilename: string;
}
```

Steps:
1. `download-and-parse`: Download file, extract text
2. `count-tokens`: Count total tokens
3. `generate-outline`: Send to LLM, generate chapter outline
4. `save-outline`: Update task with outline, set status to `outline_ready`

#### generateFromOutline

Event: `flashcard/generate-from-outline`

```typescript
{
  taskId: string;
  userId: string;
  selectedChapters: number[];
  creditsCost: number;
}
```

Steps:
1. `deduct-credits`: Validate and deduct credits
2. `extract-selected-text`: Extract text for selected chapters
3. `chunk-text`: Split into ~3500 token chunks
4. `generate-chunk-N`: Parallel LLM calls (one step per chunk)
5. `merge-and-dedupe`: Combine cards, remove duplicates
6. `save-to-database`: Create deck and cards

### Credits Strategy

| Phase | Cost | Rationale |
|-------|------|-----------|
| Document Analysis | **FREE** | Encourage uploads, lower barrier |
| Flashcard Generation | ~1 credit / 10k tokens | Pay for what you generate |

### File Size and Token Limits

| Metric | Limit | Notes |
|--------|-------|-------|
| Max file size | 50MB | Up from 10MB |
| Max tokens for outline | 128k | GPT-4o-mini context limit |
| Chunk size | ~3500 tokens | Leave room for prompts |
| Chunk overlap | 200 tokens | Maintain context |

### Outline Generation Prompt

```
You are a document structure analyzer.
Analyze the provided text and extract its chapter/section structure.

Output JSON:
{
  "chapters": [
    {
      "index": 0,
      "title": "Chapter title or section heading",
      "summary": "1-sentence summary of this section",
      "estimatedTokens": 5000,
      "textRange": { "start": 0, "end": 15000 }
    }
  ]
}

Rules:
- Identify 3-15 logical sections
- If no clear chapters, split by topic/theme
- Keep titles concise and descriptive
- Summaries should help users decide relevance
```

## Implementation Plan

### Phase 1: Backend Core Logic ✅ COMPLETED

| Task | File | Status |
|------|------|--------|
| Token counting utility | `src/lib/ai/tokenizer.ts` | ✅ DONE |
| Text chunking utility | `src/lib/ai/chunking.ts` | ✅ DONE |
| Outline generation | `src/lib/ai/outline.ts` | ✅ DONE |
| Analyze document Inngest fn | `src/inngest/functions.ts` | ✅ DONE |
| Generate from outline Inngest fn | `src/inngest/functions.ts` | ✅ DONE |
| DB schema changes | `src/db/schema.ts` | ✅ DONE |
| Server actions | `src/features/flashcards/actions/generate.ts` | ✅ DONE |
| Task API update | `src/app/api/tasks/[id]/route.ts` | ✅ DONE |
| Task status hook update | `src/features/flashcards/hooks/use-task-status.ts` | ✅ DONE |

### Phase 2: Frontend UI

| Task | File | Status |
|------|------|--------|
| Outline selector component | `src/features/flashcards/components/outline-selector.tsx` | TODO |
| Update generate form | `src/features/flashcards/components/generate-form.tsx` | TODO |
| Update task status display | `src/features/flashcards/components/task-status.tsx` | TODO |

### Phase 3: Polish

| Task | Status |
|------|--------|
| Card deduplication | ✅ DONE (in Inngest function) |
| Progress tracking UI | TODO |
| Error handling | TODO |
| Testing | TODO |

## Cost Estimation

| File Size | Pages | Est. Tokens | Outline Cost | Generation Cost (all) |
|-----------|-------|-------------|--------------|----------------------|
| Small | 1-20 | ~10k | ~$0.001 | ~$0.003 |
| Medium | 20-50 | ~30k | ~$0.003 | ~$0.010 |
| Large | 50-100 | ~60k | ~$0.006 | ~$0.020 |
| XL | 100-200 | ~120k | ~$0.012 | ~$0.040 |

*Based on GPT-4o-mini: $0.15/1M input, $0.60/1M output*

## Open Questions

1. Should we cache the extracted text in the database or re-fetch from storage?
   - **Decision**: Cache in `document_text` field for faster re-generation

2. How to handle PDFs without clear chapter structure?
   - **Decision**: AI will identify logical sections by topic

3. Maximum chapters to display?
   - **Decision**: 15 chapters max, merge smaller sections if needed
