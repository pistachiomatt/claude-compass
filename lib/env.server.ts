import { loadEnvConfig } from "@next/env"
import { z } from "zod"

console.log("Loading env...")
loadEnvConfig(process.cwd())

/**
 * Expose and parse environment variables for the client.
 */

const schema = z.object({
  NEXT_PUBLIC_BASE_URL: z.string(),
  REDIS_URL: z.string(),
  DATABASE_URL: z.string(),
  CONCURRENCY: z.coerce.number(),
  TEMP_DIR: z.string(),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON: z.any().optional(),
})

const rawEnv = {
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  CONCURRENCY: process.env.CONCURRENCY,
  TEMP_DIR: process.env.TEMP_DIR,
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
  GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON: (() => {
    const rawValue = process.env.GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON
    if (!rawValue) return rawValue
    try {
      // Assume the value is base64 encoded
      const decodedValue = Buffer.from(rawValue.trim(), "base64").toString("utf-8")
      return JSON.parse(decodedValue)
    } catch (error: any) {
      console.error("❌ Failed to decode/parse GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON:", error.message)
      console.error("Raw value length:", rawValue?.length)
      console.error("Raw value first 100 chars:", rawValue?.substring(0, 100))
      return undefined
    }
  })(),
}

// Check if validation should be disabled
const shouldDisableChecks =
  process.env.DISABLE_CHECKS === "true" || process.env.DISABLE_CHECKS === "1"

let parsedEnv: any

if (shouldDisableChecks) {
  console.log("⚠️  Environment validation disabled via DISABLE_CHECKS")

  // Use a relaxed schema (all fields optional) to retain type transformations without strict validation
  parsedEnv = schema.partial().parse(rawEnv)
} else {
  parsedEnv = schema.parse(rawEnv)
}

export type Env = z.infer<typeof schema>
export const env: Env = parsedEnv as Env

// Add aliases for backward compatibility
Object.defineProperty(env, "INSTANT_GROUPS", {
  get() {
    return this.INSTANT_RESPONSE_GROUP_IDS
  },
  enumerable: true,
})
