import { publicProcedure, router } from "../trpc"
import { env } from "@/lib/env.server"

export const configRouter = router({
  getDeepgramConfig: publicProcedure.query(() => {
    return {
      apiKey: env.DEEPGRAM_API_KEY ?? null,
    }
  }),
})
