/**
 * Test if we can restore a transcript and have SDK resume from it
 * Run with: npx tsx scripts/test-transcript-restore.ts
 */

import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { query } from "@anthropic-ai/claude-agent-sdk"
import { writeFileSync, existsSync, unlinkSync } from "fs"
import { join } from "path"

// The SDK stores transcripts here based on cwd
const TRANSCRIPT_DIR = join(
  process.env.HOME || "",
  ".claude",
  "projects",
  "-Users-matt-Sites-compass",
)

async function main() {
  console.log("🧪 Testing transcript restore...\n")

  // 1. Run initial conversation
  console.log("1. Creating initial conversation...")
  let sessionId = ""
  const response1 = query({
    prompt: "My secret code is BANANA123. Remember it.",
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
      console.log(`   Session ID: ${sessionId}`)
    }
    if (msg.type === "assistant") {
      console.log(`   Response: ${(msg.message.content[0] as any)?.text?.substring(0, 80)}...`)
    }
  }

  // 2. Read the transcript the SDK created
  const transcriptPath = join(TRANSCRIPT_DIR, `${sessionId}.jsonl`)
  console.log(`\n2. Transcript path: ${transcriptPath}`)
  console.log(`   Exists: ${existsSync(transcriptPath)}`)

  // 3. Delete the transcript (simulating dyno restart)
  console.log("\n3. Deleting transcript to simulate dyno restart...")
  if (existsSync(transcriptPath)) {
    const originalContent = require("fs").readFileSync(transcriptPath, "utf-8")
    unlinkSync(transcriptPath)
    console.log(`   Deleted. Content was ${originalContent.length} bytes`)

    // 4. Try to resume - should fail
    console.log("\n4. Trying to resume (should fail or not remember)...")
    try {
      const response2 = query({
        prompt: "What is my secret code?",
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
    } catch (e: any) {
      console.log(`   Error: ${e.message}`)
    }

    // 5. Restore the transcript
    console.log("\n5. Restoring transcript from 'DB' (our saved copy)...")
    writeFileSync(transcriptPath, originalContent)
    console.log(`   Restored ${originalContent.length} bytes`)

    // 6. Try to resume again - should work now
    console.log("\n6. Trying to resume after restore...")
    const response3 = query({
      prompt: "What is my secret code?",
      options: {
        model: "claude-sonnet-4-5",
        maxTurns: 1,
        resume: sessionId,
        allowedTools: [],
        permissionMode: "bypassPermissions",
      },
    })

    for await (const msg of response3) {
      if (msg.type === "assistant") {
        console.log(`   Response: ${(msg.message.content[0] as any)?.text}`)
      }
    }
  }

  console.log("\n✅ Test complete")
}

main().catch(console.error)
