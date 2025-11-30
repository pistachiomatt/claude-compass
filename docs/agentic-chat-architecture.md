# Agentic Chat Architecture

> This document captures the architectural decisions and implementation plan for Compass's AI chat feature using the Claude Agent SDK.

## Overview

Compass is building a Claude.ai-like chat experience with an agentic backend. Users chat with Claude in text while Claude can read, write, and manage a per-session "filesystem" of markdown documents.

### Key Goals

- Thread-based conversations with text turns
- Claude Code built-in tools (Read, Write, Edit, Bash, etc.)
- Per-thread virtual filesystem of MD files stored in the database
- Agentic tool calling loop (text → tool call → tool response → repeat)
- Real-time streaming of responses to the UI
- Tool call status UI (in progress, complete, diffs)
- assistant-ui for frontend rendering

---

## End Goals (Full Vision)

This section tracks the complete feature set we're building toward, in stages.

### Stage 1: MVP ✅ COMPLETE

- [x] Install Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- [x] DB schema: `chats.sdkSessionId` added
- [x] Service layer: `lib/services/agentSession.ts`
- [x] tRPC routes: `chat.sendMessage`, `chat.getMessages`
- [x] Basic flow: user message → SDK response → persist both
- [x] SDK session ID stored in chat for future resume
- [x] Session resume from DB when SDK transcript is gone (Stage 2)

### Stage 2: Virtual Filesystem ✅ COMPLETE

- [x] DB schema: `chats.files` JSONB column (simpler than separate table)
- [x] Temp directory hydration (`/tmp/compass/{chatId}/`)
- [x] File sync after each turn (temp dir → DB)
- [x] Enable Read/Write/Edit/Glob/Grep tools

### Stage 3: Streaming

- [ ] tRPC SSE subscription for streaming
- [ ] Stream event types (text_delta, tool_call_start, etc.)
- [ ] Real-time message updates during generation

### Stage 4: Frontend (assistant-ui)

- [ ] Install assistant-ui
- [ ] ExternalStoreRuntime adapter
- [ ] Message components (text, tool calls, tool results)
- [ ] Streaming UI updates

### Stage 5: Polish

- [ ] Extended thinking UI (collapsible)
- [ ] Error handling (rate limits, failures)
- [ ] Cost tracking in DB
- [ ] Tool call diff visualization

---

## Technology Stack

| Layer    | Technology                      |
| -------- | ------------------------------- |
| Frontend | Next.js 14, React, assistant-ui |
| API      | tRPC v11 with SSE streaming     |
| Backend  | Claude Agent SDK (TypeScript)   |
| Database | PostgreSQL via Drizzle ORM      |
| Hosting  | Heroku (persistent dyno)        |

---

## Claude Agent SDK Summary

### What It Is

The Claude Agent SDK is the same agent harness that powers Claude Code, packaged as an SDK. It provides:

- **Built-in tools**: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebFetch`, `WebSearch`, `TodoWrite`
- **Agentic loop**: Automatically handles text → tool call → tool result → text cycles
- **Session management**: Resume/fork conversations
- **Context management**: Automatic compaction when context gets long
- **Custom tools**: Via MCP servers (in-process or external)

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Authentication (Vertex AI)

Compass uses Google Vertex AI for Claude. The SDK reads these environment variables:

```bash
# Required for Vertex AI
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global                    # or specific region like "us-east5"
ANTHROPIC_VERTEX_PROJECT_ID=your-gcp-project-id

# Authentication: Uses Google Application Default Credentials
# Either: gcloud auth application-default login
# Or: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

See: https://code.claude.com/docs/en/google-vertex-ai

### Core API

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk"

// Streaming mode (recommended)
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: "Hello" },
  }
}

for await (const message of query({
  prompt: generateMessages(),
  options: {
    cwd: "/path/to/working/dir",
    maxTurns: 10,
    allowedTools: ["Read", "Write", "Edit"],
    includePartialMessages: true, // For streaming text
    maxThinkingTokens: 10000, // For extended thinking
  },
})) {
  // message types: 'system' | 'assistant' | 'user' | 'result' | 'stream_event'
  console.log(message)
}
```

### Message Types

| Type                       | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `system` (subtype: `init`) | Session started, includes `session_id`                         |
| `assistant`                | Claude's response with content blocks                          |
| `user`                     | User messages (echoed back)                                    |
| `stream_event`             | Partial streaming chunks (when `includePartialMessages: true`) |
| `result`                   | Final result with `success`/`error`, usage stats, cost         |

### Session Management

```typescript
// Resume a previous session
const response = query({
  prompt: "Continue from where we left off",
  options: {
    resume: "session-xyz", // Session ID from previous conversation
  },
})

// Fork a session (creates new branch)
const response = query({
  prompt: "Try a different approach",
  options: {
    resume: "session-xyz",
    forkSession: true,
  },
})
```

---

## Architecture Decision: Heroku + In-Process SDK

### How the SDK Works (Important!)

The SDK is **stateless per-call**, not one instance per user:

- Each `query()` call is independent - call it, it runs, it returns
- Sessions are transcript **files on disk**, not in-memory state
- One dyno (one process) serves all users/chats
- The SDK reads/writes transcript files keyed by `session_id`
- Think of it like a database client, not a server instance

```
┌─────────────────────────────────────────────────────┐
│                    Heroku Dyno                      │
│  ┌───────────────────────────────────────────────┐  │
│  │              Next.js Process                  │  │
│  │                                               │  │
│  │  User A chat 1 ──► query() ──► transcript_a1  │  │
│  │  User A chat 2 ──► query() ──► transcript_a2  │  │
│  │  User B chat 1 ──► query() ──► transcript_b1  │  │
│  │                                               │  │
│  │  (All share same process, SDK is stateless)   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Why Heroku Works

- ✅ Persistent dyno = transcript files survive between requests
- ✅ No container orchestration needed
- ✅ Simple deployment
- ⚠️ Dyno restart = transcript files lost (we recover from DB)

### Alternative (Future) - Sandbox Containers

For production scale with better isolation:

- E2B, Modal, Cloudflare Sandboxes, Fly Machines
- True filesystem per session
- Better security isolation between users

---

## Virtual Filesystem Strategy

### Problem

Each chat thread needs its own isolated "filesystem" of markdown documents. Users shouldn't browse the actual Heroku filesystem. The Agent SDK's built-in tools expect real file operations.

### Solution: Temp Directory Sync

1. **On session start**: Hydrate `/tmp/compass/{chatId}/` from database
2. **During session**: Built-in `Read`/`Write`/`Edit` tools work normally against temp dir
3. **After each turn**: Sync changes back to database
4. **On session end**: Clean up temp directory (optional)

### Database Schema for Virtual Filesystem

```typescript
// In db/schema.ts

export const chatFiles = pgTable("chat_files", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => getUuid()),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  path: text("path").notNull(), // e.g., "notes/todo.md"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Unique constraint on chatId + path
```

### Alternative: Custom MCP Tools

Instead of temp directory sync, replace built-in tools with custom ones:

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

const filesystemServer = createSdkMcpServer({
  name: "compass-filesystem",
  tools: [
    tool(
      "read_file",
      "Read a file from the chat's virtual filesystem",
      { path: z.string() },
      async args => {
        const file = await db.query.chatFiles.findFirst({
          where: and(eq(chatFiles.chatId, currentChatId), eq(chatFiles.path, args.path)),
        })
        return { content: [{ type: "text", text: file?.content ?? "File not found" }] }
      },
    ),
    // ... write_file, edit_file, list_files, etc.
  ],
})
```

**Recommendation**: Start with temp directory sync (simpler), consider custom MCP tools if needed.

---

## Session Persistence Strategy

### How SDK Sessions Work

The Agent SDK stores sessions as **transcript files on the local filesystem** (see `transcript_path` in hook inputs). There is no built-in database adapter - this is by design for the CLI use case.

Key insight from hook types:

```typescript
type BaseHookInput = {
  session_id: string
  transcript_path: string // Sessions stored as local files
  cwd: string
}
```

### Our Approach: DB as Source of Truth + SDK Session Opportunism

Since SDK sessions are ephemeral (lost on dyno restart), we maintain our own persistent state:

1. **Store in database** (always):

   - Chat metadata (id, title, createdAt)
   - Messages (role, content, toolCalls, toolResults)
   - SDK session ID (for potential resume while process is alive)
   - Virtual filesystem state

2. **On session resume**:

   - Check if SDK session still exists locally (`resume: sdkSessionId`)
   - If yes → SDK handles context automatically
   - If no (dyno restarted) → Hydrate new SDK session with message history from DB

3. **Hydration strategy** (when SDK session is gone):
   - Load messages from DB
   - Hydrate virtual filesystem to temp dir
   - Start new SDK query with conversation context via `prompt` (async generator yielding prior messages)
   - Store new `session_id` in DB for future resumes

### Database Schema for Messages

```typescript
export const messages = pgTable("messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => getUuid()),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: jsonb("content").notNull(), // Anthropic content block format
  sdkMessageUuid: text("sdk_message_uuid"), // For correlation
  parentToolUseId: text("parent_tool_use_id"), // For tool result threading
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const chats = pgTable("chats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => getUuid()),
  title: text("title"),
  sdkSessionId: text("sdk_session_id"), // For SDK resume
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

---

## Streaming Architecture

### tRPC SSE Streaming

tRPC supports Server-Sent Events for streaming. The pattern:

```typescript
// In router
export const chatRouter = router({
  sendMessage: publicProcedure
    .input(z.object({ chatId: z.string(), content: z.string() }))
    .subscription(async function* ({ input }) {
      // Start Agent SDK query
      for await (const message of query({ ... })) {
        // Convert SDK message to our format
        yield convertToStreamEvent(message);
      }
    }),
});
```

### Stream Event Types (Frontend)

```typescript
type ChatStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "thinking_delta"; delta: string }
  | { type: "tool_call_start"; toolName: string; toolCallId: string }
  | { type: "tool_call_complete"; toolCallId: string; result: unknown }
  | { type: "message_complete"; message: Message }
  | { type: "error"; error: string }
```

---

## assistant-ui Integration

### The Challenge

assistant-ui expects messages in `ThreadMessageLike` format. The Agent SDK emits `SDKMessage`. We need an adapter layer.

### ThreadMessageLike Format

```typescript
type ThreadMessageLike = {
  role: "user" | "assistant" | "system"
  content: string | MessagePart[]
  id?: string
  createdAt?: Date
  status?: "in_progress" | "complete" | "cancelled"
}

type MessagePart =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; result: unknown }
```

### Adapter Pattern

```typescript
function convertSDKMessage(msg: SDKMessage): ThreadMessageLike | null {
  if (msg.type === "assistant") {
    return {
      role: "assistant",
      content: msg.message.content.map(block => {
        if (block.type === "text") {
          return { type: "text", text: block.text }
        }
        if (block.type === "tool_use") {
          return {
            type: "tool-call",
            toolCallId: block.id,
            toolName: block.name,
            args: block.input,
          }
        }
        // ... handle other block types
      }),
      id: msg.uuid,
    }
  }
  // ... handle other message types
}
```

### Runtime Provider

```typescript
"use client";

import { useExternalStoreRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";

export function ChatRuntimeProvider({ chatId, children }) {
  const { data: messages = [] } = trpc.message.list.useQuery(chatId);
  const [isRunning, setIsRunning] = useState(false);

  const sendMutation = trpc.chat.sendMessage.useMutation();

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage: (msg) => ({ /* ... */ }),
    onNew: async (message) => {
      setIsRunning(true);
      // Subscribe to SSE stream, update messages as they arrive
      // ...
      setIsRunning(false);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

---

## Service Layer (DRY Approach)

To keep DB interactions clean and avoid scattered touchpoints, we'll create a single service module that handles all SDK ↔ DB coordination:

```typescript
// lib/services/agentSession.ts

export const agentSession = {
  /**
   * Start or resume a chat session with the SDK
   * Handles: hydration from DB, temp dir setup, SDK query creation
   */
  async *query(chatId: string, userMessage: string): AsyncGenerator<SDKMessage> {
    // 1. Load chat from DB (with messages and files)
    // 2. Hydrate temp directory with files
    // 3. Check if SDK session exists, otherwise replay history
    // 4. Yield SDK messages, persisting each to DB
    // 5. After turn: sync temp dir changes back to DB
  },

  /**
   * Sync temp directory changes back to database
   */
  async syncFilesToDb(chatId: string): Promise<void> {},

  /**
   * Hydrate temp directory from database
   */
  async hydrateFilesFromDb(chatId: string): Promise<string> {}, // returns temp path

  /**
   * Persist an SDK message to the database
   */
  async persistMessage(chatId: string, message: SDKMessage): Promise<void> {},

  /**
   * Load chat with all messages for SDK hydration
   */
  async loadChatContext(chatId: string): Promise<ChatContext> {},
}
```

This gives us:

- **Single source of truth** for SDK ↔ DB logic
- **Consistent file sync** before/after each turn
- **Clean tRPC routes** that just call `agentSession.query()`
- **Testable** service layer (mock DB, test SDK interactions)

---

## Open Questions

### 1. Tool Permissions

**Question**: Which tools should be allowed per session?

```typescript
options: {
  allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
  // OR
  disallowedTools: ["Bash", "WebFetch"], // More restrictive
  permissionMode: "acceptEdits", // Auto-approve file edits
}
```

**Recommendation**: Start with Read/Write/Edit/Glob/Grep. Avoid Bash initially for security.

### 2. Extended Thinking UI

**Question**: How do we display Claude's thinking process?

The SDK supports `maxThinkingTokens` and streams thinking via `stream_event`. We need UI for:

- Collapsible thinking section
- Real-time thinking updates
- Transition from thinking to response

### 3. Error Handling

**Question**: How do we handle:

- SDK errors (API failures, rate limits)
- Tool execution failures
- Session timeout/expiration

### 4. Cost Tracking

The SDK provides usage stats in `SDKResultMessage`:

```typescript
{
  type: 'result',
  subtype: 'success',
  total_cost_usd: 0.0234,
  usage: {
    input_tokens: 1500,
    output_tokens: 500,
    cache_creation_input_tokens: 200,
    cache_read_input_tokens: 1000,
  }
}
```

**Question**: Do we track/display this to users? Store in DB?

---

## Implementation Phases

### Phase 1: Core Backend

- [ ] Set up Agent SDK in tRPC route
- [ ] Database schema for chats, messages, files
- [ ] Basic send message → get response flow
- [ ] Temp directory sync for virtual filesystem

### Phase 2: Streaming

- [ ] tRPC SSE subscription for streaming responses
- [ ] Stream event types and parsing
- [ ] Text delta streaming
- [ ] Tool call status streaming

### Phase 3: Frontend

- [ ] assistant-ui integration
- [ ] ExternalStoreRuntime adapter
- [ ] Message components (text, tool calls, tool results)
- [ ] Streaming UI updates

### Phase 4: Polish

- [ ] Extended thinking UI
- [ ] Error handling
- [ ] Session resume from DB
- [ ] Cost tracking

---

## Reference Links

### Claude Agent SDK

- [Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Streaming vs Single Mode](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Hosting](https://platform.claude.com/docs/en/agent-sdk/hosting)

### assistant-ui

- [Getting Started](https://www.assistant-ui.com/docs/getting-started)
- [ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)
- [Thread Component](https://www.assistant-ui.com/docs/ui/Thread)

---

## Compass Repo Context

### Existing Stack

- **Frontend**: Next.js 14 (App Router)
- **API**: tRPC v11
- **Database**: PostgreSQL via Drizzle ORM
- **Background Jobs**: BullMQ with Redis
- **AI**: Anthropic Claude API (existing integration in `lib/api/anthropicApi.ts`)

### Key Files

- `app/api/trpc/[trpc]/routers/` - tRPC routers
- `db/schema.ts` - Drizzle schema (source of truth for types)
- `lib/utils/getUuid.ts` - ID generation (16-char nanoid)
- `app/chats/[id]/` - Chat detail page

### Conventions

- All entity IDs use `getUuid()` (16-char nanoid)
- tRPC uses `publicProcedure` (internal tool, no auth)
- Types come from Drizzle schema, not redefined
- UI uses Shadcn + Tailwind

---

_Last updated: 2025-11-30_
