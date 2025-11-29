import { router } from "../trpc"
import { demoRouter } from "./_demo.router"

export const appRouter = router({
  demo: demoRouter,
})

export type AppRouter = typeof appRouter
