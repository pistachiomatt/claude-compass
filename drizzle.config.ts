import { defineConfig } from "drizzle-kit"
import { env } from "./lib/env.server"

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? true : false,
  },
})
