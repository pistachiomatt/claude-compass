import { db } from '@/db'
import { ChatPlatform, chats } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { ChatContext, ChatInterface } from '@/lib/chat/types'
import { adapterPool } from './adapterPool'

interface CreateChatContextParams {
  chatId: string
  platform: ChatPlatform
}

/**
 * Creates a ChatContext for background job processing
 * This allows jobs to access platform-specific functionality
 */
export async function createChatContext({
  chatId,
  platform,
}: CreateChatContextParams): Promise<ChatContext> {
  // Get chat from database
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1)

  if (!chat) {
    throw new Error(`Chat not found: ${chatId}`)
  }

  // Get adapter from pool (reuses existing connections)
  const adapter = await adapterPool.getAdapter(platform)

  // Build context
  const chatInterface: ChatInterface = {
    id: chat.id,
    platformId: chat.platformId,
    platform: chat.platform,
    name: chat.name,
    memberCount: chat.memberCount || undefined,
  }

  const chatPlatform: ChatPlatform = platform

  return {
    adapter,
    chat: chatInterface,
    platform: chatPlatform,
  }
}
