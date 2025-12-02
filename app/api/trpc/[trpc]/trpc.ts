import { initTRPC } from "@trpc/server"
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { transformer } from "@/lib/trpc/transformer"
import { ZodError } from "zod"

export async function createContext(opts: FetchCreateContextFnOptions) {
  const authCookie = opts.req.headers
    .get("cookie")
    ?.split(";")
    .find(c => c.trim().startsWith("auth="))
  const email = authCookie ? decodeURIComponent(authCookie.split("=")[1]) : null

  return {
    email,
  }
}

const t = initTRPC.context<typeof createContext>().create({
  transformer,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
