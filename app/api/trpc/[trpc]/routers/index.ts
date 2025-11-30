import { router } from "../trpc"
import { chatRouter } from "./chat.router"
import { configRouter } from "./config.router"

export const appRouter = router({
  chat: chatRouter,
  config: configRouter,
})

export type AppRouter = typeof appRouter
