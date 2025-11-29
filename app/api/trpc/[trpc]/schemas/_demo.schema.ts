import { z } from 'zod'
import { zChat, zMessage, zToolCall } from '@/app/api/db.types'

// API-specific chat schema
export const ChatSchema = zChat.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const MessageSchema = zMessage.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const StreamMessageSchema = zChat
  .pick({
    _id: true,
    promptId: true,
  })
  .extend({
    messages: z.array(
      zMessage
        .pick({
          _id: true,
          role: true,
          sequenceNumber: true,
          content: true,
          tool_calls: true,
          tool_call_id: true,
        })
        .partial(),
    ),
  })
  .or(z.literal('[DONE]'))

// Input schemas
export const CreateChatSchema = ChatSchema.pick({
  promptId: true,
})

/**
 * @param isContentSkipped - If true, a user turn won't be created; only the
 * existing context will be used to create a new assistant turn.
 */
export const SendMessageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  content: zMessage.shape.content,
  isContentSkipped: z.boolean().optional(),
})

export const EditMessageSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  content: zMessage.shape.content,
})

export const DeleteMessageSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
})

/**
 * @param isInclusive - If true, the message will be included (i.e. deleted)
 * in the rollback, otherwise everything up to and not including the message will be deleted.
 */
export const RollbackToMessageSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  isInclusive: z.boolean(),
})

export const ToolResponseSchema = z.object({
  tool_call_id: z.string(),
  content: z.string(),
})

export const SendToolResponsesSchema = z.object({
  chatId: z.string(),
  responses: z.array(ToolResponseSchema),
})

export type ChatType = z.infer<typeof ChatSchema>
export type MessageType = z.infer<typeof MessageSchema>
export type StreamMessageType = z.infer<typeof StreamMessageSchema>
export type SendMessageType = z.infer<typeof SendMessageSchema>
export type ToolCallType = z.infer<typeof zToolCall>
export type ToolResponseType = z.infer<typeof ToolResponseSchema>
export type SendToolResponsesType = z.infer<typeof SendToolResponsesSchema>
