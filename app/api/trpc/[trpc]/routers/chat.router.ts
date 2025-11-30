import { router, publicProcedure } from "../trpc"
import { db } from "@/db"
import { chats, messages, MessageRole, type Chat } from "@/db/schema"
import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { agentSession } from "@/lib/agent/agentSession"
import { type AgentTurnResult } from "@/lib/agent/types"
import { type StreamEvent } from "@/lib/agent/streamTypes"
import { env } from "@/lib/env.server"

export const chatRouter = router({
  getById: publicProcedure.input(z.string()).query(async ({ input }): Promise<Chat> => {
    const result = await db
      .select({
        id: chats.id,
        name: chats.name,
        isDisabled: chats.isDisabled,
        sdkSessionId: chats.sdkSessionId,
        sdkTranscript: chats.sdkTranscript,
        files: chats.files,
        createdAt: chats.createdAt,
        updatedAt: chats.updatedAt,
      })
      .from(chats)
      .where(eq(chats.id, input))
    const chat = result[0]
    if (!chat) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat not found",
      })
    }
    return chat
  }),

  create: publicProcedure.mutation(async (): Promise<Chat> => {
    const result = await db
      .insert(chats)
      .values({
        name: "Untitled",
      })
      .returning()

    return result[0]
  }),

  /**
   * Send a message to the agent and get a response
   * MVP: Non-streaming, waits for complete response
   */
  sendMessage: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ input }): Promise<AgentTurnResult> => {
      // Verify chat exists
      const chat = await db
        .select({ id: chats.id })
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .then(rows => rows[0])

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        })
      }

      // Run agent turn
      return agentSession.runTurn(input.chatId, input.content)
    }),

  /**
   * Get all messages for a chat
   */
  getMessages: publicProcedure.input(z.string()).query(async ({ input }) => {
    return agentSession.getMessages(input)
  }),

  /**
   * Send a message and stream the response
   * Uses tRPC subscription for SSE streaming
   */
  sendMessageStream: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        content: z.string().min(1),
      }),
    )
    .subscription(async function* ({ input }): AsyncGenerator<StreamEvent> {
      // Verify chat exists
      const chat = await db
        .select({ id: chats.id })
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .then(rows => rows[0])

      if (!chat) {
        yield { type: "error", error: "Chat not found" }
        return
      }

      // Save user message BEFORE streaming to prevent duplicates on retry
      await db.insert(messages).values({
        chatId: input.chatId,
        role: MessageRole.USER,
        contentBlocks: [{ type: "text", text: input.content }],
      })

      // Stream events from agent session
      // Enable extended thinking by default
      try {
        for await (const event of agentSession.runTurnStream(input.chatId, input.content, {
          maxThinkingTokens: env.MAX_THINKING_TOKENS,
        })) {
          yield event
        }
      } catch (error) {
        console.error("sendMessageStream error:", error)
        yield {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown streaming error",
        }
      }
    }),
})
