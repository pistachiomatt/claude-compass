/**
 * Investigate SDK transcript format
 * Run with: npx tsx scripts/investigate-sdk-transcript.ts
 */

import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { query } from "@anthropic-ai/claude-agent-sdk"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"

async function main() {
  console.log("🔍 Investigating SDK transcript format...\n")

  let sessionId = ""
  let transcriptPath = ""

  // Run a simple conversation
  console.log("1. Running first message...")
  const response1 = query({
    prompt: "My name is Alice. Remember this.",
    options: {
      model: "claude-sonnet-4-5",
      maxTurns: 1,
      allowedTools: [],
      permissionMode: "bypassPermissions",
    },
  })

  for await (const msg of response1) {
    if (msg.type === "system" && msg.subtype === "init") {
      sessionId = msg.session_id
      transcriptPath = (msg as any).transcript_path || ""
      console.log(`   Session ID: ${sessionId}`)
      console.log(`   Transcript path from init: ${transcriptPath || "not provided"}`)
    }
    if (msg.type === "assistant") {
      console.log(`   Response: ${(msg.message.content[0] as any)?.text?.substring(0, 100)}...`)
    }
  }

  // Check for transcript files in common locations
  console.log("\n2. Looking for transcript files...")
  const possiblePaths = [
    join(process.env.HOME || "", ".claude", "sessions"),
    join(process.env.HOME || "", ".claude-code", "sessions"),
    join(process.cwd(), ".claude", "sessions"),
    "/tmp/claude-sessions",
  ]

  for (const basePath of possiblePaths) {
    if (existsSync(basePath)) {
      console.log(`   Found: ${basePath}`)
      try {
        const files = readdirSync(basePath)
        console.log(`   Files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`)

        // Look for our session
        const sessionFile = files.find(f => f.includes(sessionId))
        if (sessionFile) {
          const fullPath = join(basePath, sessionFile)
          console.log(`\n3. Found session file: ${fullPath}`)
          const content = readFileSync(fullPath, "utf-8")
          console.log("\n--- Transcript Content (first 2000 chars) ---")
          console.log(content.substring(0, 2000))
          console.log("--- End ---\n")

          // Try to parse as JSON
          try {
            const parsed = JSON.parse(content)
            console.log("\n4. Parsed transcript structure:")
            console.log(`   Type: ${typeof parsed}`)
            console.log(`   Is Array: ${Array.isArray(parsed)}`)
            if (Array.isArray(parsed)) {
              console.log(`   Length: ${parsed.length}`)
              console.log(`   First item keys: ${Object.keys(parsed[0] || {}).join(", ")}`)
            } else {
              console.log(`   Keys: ${Object.keys(parsed).join(", ")}`)
            }
          } catch {
            console.log("   Not valid JSON - might be JSONL or other format")
          }
        }
      } catch (e) {
        console.log(`   Error reading: ${e}`)
      }
    }
  }

  // Now resume and ask follow-up
  console.log("\n5. Testing resume with follow-up question...")
  const response2 = query({
    prompt: "What is my name?",
    options: {
      model: "claude-sonnet-4-5",
      maxTurns: 1,
      resume: sessionId,
      allowedTools: [],
      permissionMode: "bypassPermissions",
    },
  })

  for await (const msg of response2) {
    if (msg.type === "assistant") {
      console.log(`   Response: ${(msg.message.content[0] as any)?.text}`)
    }
  }

  console.log("\n✅ Investigation complete")
}

main().catch(console.error)
