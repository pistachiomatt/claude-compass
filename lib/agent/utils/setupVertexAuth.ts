/**
 * Setup Vertex AI authentication for Claude Agent SDK
 *
 * The SDK expects GOOGLE_APPLICATION_CREDENTIALS to be a file path.
 * We have credentials as JSON in GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON.
 * This writes them to a temp file and sets the env var.
 */

import { writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { env } from "@/lib/env.server"

let initialized = false

export function setupVertexAuth(): void {
  if (initialized) return

  // Skip if no Vertex credentials provided
  if (!env.GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON) {
    console.warn("⚠️  GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON not set - Agent SDK may fail")
    return
  }

  // Write credentials to temp file
  const tempDir = env.TEMP_DIR || "/tmp"
  const credentialsDir = join(tempDir, "compass-credentials")
  const credentialsPath = join(credentialsDir, "vertex-service-account.json")

  if (!existsSync(credentialsDir)) {
    mkdirSync(credentialsDir, { recursive: true })
  }

  writeFileSync(credentialsPath, JSON.stringify(env.GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON, null, 2))

  // Set env vars for SDK
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath
  process.env.CLAUDE_CODE_USE_VERTEX = "1"
  process.env.CLOUD_ML_REGION = process.env.CLOUD_ML_REGION
  process.env.ANTHROPIC_VERTEX_PROJECT_ID = env.GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON?.project_id

  initialized = true
  console.log("✅ Vertex AI auth configured for Agent SDK")
}
