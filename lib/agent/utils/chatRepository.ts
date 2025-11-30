/**
 * Chat Repository
 *
 * All database operations for chats and messages.
 * Keeps DB logic separate from SDK orchestration.
 */

import { db } from "@/db"
import { chats, messages, MessageRole, type ContentBlock, type VirtualFiles } from "@/db/schema"
import { eq, asc } from "drizzle-orm"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  role: string
  contentBlocks: ContentBlock[]
  createdAt: Date
}

export interface ChatWithMessages {
  id: string
  name: string
  sdkSessionId: string | null
  files: VirtualFiles
  messages: ChatMessage[]
}

export interface CreateMessageInput {
  chatId: string
  role: MessageRole
  contentBlocks: ContentBlock[]
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const chatRepository = {
  /**
   * Get a chat by ID
   */
  async getById(chatId: string) {
    return db
      .select({
        id: chats.id,
        name: chats.name,
        sdkSessionId: chats.sdkSessionId,
        files: chats.files,
        createdAt: chats.createdAt,
        updatedAt: chats.updatedAt,
      })
      .from(chats)
      .where(eq(chats.id, chatId))
      .then(rows => rows[0] ?? null)
  },

  /**
   * Get all messages for a chat
   */
  async getMessages(chatId: string): Promise<ChatMessage[]> {
    const rows = await db
      .select({
        id: messages.id,
        role: messages.role,
        contentBlocks: messages.contentBlocks,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt))

    return rows.map(row => ({
      ...row,
      contentBlocks: row.contentBlocks ?? [],
    }))
  },

  /**
   * Get chat with all messages (for hydration)
   */
  async getChatWithMessages(chatId: string): Promise<ChatWithMessages | null> {
    const chat = await this.getById(chatId)
    if (!chat) return null

    const chatMessages = await this.getMessages(chatId)
    return {
      id: chat.id,
      name: chat.name,
      sdkSessionId: chat.sdkSessionId,
      files: chat.files ?? {},
      messages: chatMessages,
    }
  },

  /**
   * Create a new message
   */
  async createMessage(input: CreateMessageInput) {
    const { chatId, role, contentBlocks } = input

    return db
      .insert(messages)
      .values({
        chatId,
        role,
        contentBlocks,
      })
      .returning()
      .then(rows => rows[0])
  },

  /**
   * Update chat's SDK session ID
   */
  async updateSdkSessionId(chatId: string, sdkSessionId: string) {
    return db
      .update(chats)
      .set({
        sdkSessionId,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chatId))
  },

  /**
   * Update chat's SDK session and transcript together (atomic)
   */
  async updateSdkSession(chatId: string, sdkSessionId: string, sdkTranscript: string) {
    return db
      .update(chats)
      .set({
        sdkSessionId,
        sdkTranscript,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chatId))
  },

  /**
   * Get the raw SDK transcript for restoration
   */
  async getTranscript(
    chatId: string,
  ): Promise<{ sdkSessionId: string | null; sdkTranscript: string | null } | null> {
    return db
      .select({
        sdkSessionId: chats.sdkSessionId,
        sdkTranscript: chats.sdkTranscript,
      })
      .from(chats)
      .where(eq(chats.id, chatId))
      .then(rows => rows[0] ?? null)
  },

  /**
   * Update chat's virtual files
   */
  async updateFiles(chatId: string, files: VirtualFiles) {
    return db
      .update(chats)
      .set({
        files,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chatId))
  },
}
