import { router, publicProcedure } from "../trpc"
import { db } from "@/db"
import { chats, type Chat } from "@/db/schema"
import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { agentSession } from "@/lib/agent/agentSession"
import { type AgentTurnResult } from "@/lib/agent/types"

export const chatRouter = router({
  getById: publicProcedure.input(z.string()).query(async ({ input }): Promise<Chat> => {
    const result = await db
      .select({
        id: chats.id,
        name: chats.name,
        isDisabled: chats.isDisabled,
        sdkSessionId: chats.sdkSessionId,
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
})
