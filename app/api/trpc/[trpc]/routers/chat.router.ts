import { router, publicProcedure } from "../trpc"
import { db } from "@/db"
import { chats, Chat } from "@/db/schema"
import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

export const chatRouter = router({
  getById: publicProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Chat> => {
      const result = await db.select().from(chats).where(eq(chats.id, input))
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
})