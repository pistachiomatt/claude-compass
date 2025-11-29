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
    content: text("content"),
    toolCalls: safeJsonb("tool_calls")
      .$type<
        Array<{
          id: string
          name: string
          data: string
        }>
      >()
      .default([]),
    toolResponses: safeJsonb("tool_responses")
      .$type<
        Array<{
          toolCallId: string
          name: string
          content?: string
          metadata?: any
        }>
      >()
      .default([]),
    thinking: text("thinking"),
    thinkingBlocks: text("thinking_blocks"), // Serialized ThinkingBlock[]
    citations: safeJsonb("citations")
      .$type<
        Array<{
          type: string // 'search_result_location', 'char_location', 'page_location', 'content_block_location'
          source?: string // URL for search results
          title?: string // Document/search result title
          citedText: string // The exact text being cited
          documentIndex?: number // For document citations
          documentTitle?: string // For document citations
          searchResultIndex?: number // For search result citations
          startCharIndex?: number // For char_location type (from source document)
          endCharIndex?: number // For char_location type (from source document)
          startPageNumber?: number // For page_location type
          endPageNumber?: number // For page_location type
          startBlockIndex?: number // For content_block_location type
          endBlockIndex?: number // For content_block_location type
          contentStartCharIndex?: number // Position in response content where citation should be inserted
          contentEndCharIndex?: number // End position in response content for citation
        }>
      >()
      .default([]),
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
