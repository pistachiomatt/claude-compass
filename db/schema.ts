import { pgTable, text, timestamp, boolean, jsonb, pgEnum, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import getUuid from "@/lib/utils/getUuid"
import { enumToPgEnum } from "./dbHelpers"
import { safeJsonb } from "./customTypes"

export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
  TOOL = "tool",
}

// Postgres Enums (automatically converted from TypeScript enums)
export const roleEnum = pgEnum("role", enumToPgEnum(MessageRole))

// Virtual filesystem file structure
// Key is the relative path (e.g., "notes/todo.md")
export interface VirtualFile {
  content: string
  updatedAt: string // ISO timestamp
}

export type VirtualFiles = Record<string, VirtualFile>

// Tables
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => getUuid()),
    name: text("name").notNull(),
    isAi: boolean("is_ai").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => {
    return {
      isAiIdx: index("is_ai_idx").on(table.isAi),
    }
  },
)

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => getUuid()),
    name: text("name").notNull(),
    isDisabled: boolean("is_disabled").default(false).notNull(),
    // Claude Agent SDK session ID - stored for potential resume while process is alive
    // If null or stale, we hydrate a new SDK session from our stored messages
    sdkSessionId: text("sdk_session_id"),
    // Raw SDK transcript JSONL - stored verbatim for 1:1 hydration after process restart
    // This is the exact content of ~/.claude/projects/{path}/{sessionId}.jsonl
    sdkTranscript: text("sdk_transcript"),
    // Virtual filesystem - markdown files Claude can read/write/edit
    // Hydrated to temp dir before each turn, synced back after
    files: safeJsonb("files").$type<VirtualFiles>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => {
    return {}
  },
)

// Content block types matching Anthropic API response format
// Stored as-is from the API for perfect fidelity
export interface TextContentBlock {
  type: "text"
  text: string
}

export interface ToolUseContentBlock {
  type: "tool_use"
  id: string
  name: string
  input: unknown
}

export interface ToolResultContentBlock {
  type: "tool_result"
  tool_use_id: string
  content: unknown
  is_error?: boolean
}

export interface ThinkingContentBlock {
  type: "thinking"
  thinking: string
}

export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ThinkingContentBlock
  | { type: string; [key: string]: unknown } // Future block types

export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => getUuid()),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id),
    userId: text("user_id").references(() => users.id), // null for system messages
    role: roleEnum("role").notNull(),
    // Raw content blocks from Anthropic API - stored verbatim
    // For user messages: [{ type: "text", text: "..." }]
    // For assistant messages: [{ type: "text", ... }, { type: "tool_use", ... }, { type: "thinking", ... }]
    contentBlocks: safeJsonb("content_blocks").$type<ContentBlock[]>().default([]),
    // User-provided attachments (images, files) - separate from API response
    attachments: safeJsonb("attachments")
      .$type<
        Array<{
          id: string
          url?: string
          contentType: string
          caption?: string
          content?: string // For text attachments
          filename: string
          size: number
          width?: number
          height?: number
        }>
      >()
      .default([]),
    replyToId: text("reply_to_id"),
    metadata: jsonb("metadata"), // Additional platform-specific data
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => {
    return {
      chatCreatedIdx: index("chat_created_idx").on(table.chatId, table.createdAt),
      chatUserIdx: index("chat_user_idx").on(table.chatId, table.userId),
      userIdx: index("user_idx").on(table.userId),
    }
  },
)

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
  }),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export const messageVirtuals = {}
