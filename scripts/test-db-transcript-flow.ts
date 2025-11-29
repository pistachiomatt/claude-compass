/**
 * Test the full transcript save/restore flow through the DB
 *
 * This simulates:
 * 1. Create a chat with a secret
 * 2. Verify transcript is saved to DB
 * 3. Delete the transcript FILE (simulating process restart)
 * 4. Send a follow-up message (should restore from DB and resume)
 * 5. Verify Claude remembers the secret
 *
 * Run with: npx tsx scripts/test-db-transcript-flow.ts
 */

import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { db } from "../db"
import { chats, messages, type ContentBlock } from "../db/schema"
import getUuid from "../lib/utils/getUuid"
import { agentSession } from "../lib/agent/agentSession"
import { existsSync, unlinkSync } from "fs"
import { join } from "path"
import { eq } from "drizzle-orm"

// Extract text from content blocks
function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text)
    .join("\n")
}

// Calculate transcript path like the SDK does
function getTranscriptPath(sessionId: string): string {
  const cwd = process.cwd()
  const sanitizedPath = cwd.replace(/\//g, "-")
  return join(process.env.HOME || "", ".claude", "projects", sanitizedPath, `${sessionId}.jsonl`)
}

async function main() {
  console.log("🧪 Testing DB transcript save/restore flow...\n")

  // 1. Create a test chat
  console.log("1. Creating test chat...")
  const chatId = getUuid()
  await db.insert(chats).values({
    id: chatId,
    name: "Transcript Flow Test",
  })
  console.log(`   Chat ID: ${chatId}`)

  // 2. Send first message with secret
  console.log("\n2. Sending first message with secret code...")
  const result1 = await agentSession.runTurn(
    chatId,
    "My secret code is MANGO456. Please remember it.",
  )
  const text1 = extractText(result1.contentBlocks)
  console.log(`   SDK Session: ${result1.sdkSessionId}`)
  console.log(`   Response: ${text1.substring(0, 100)}...`)

  // 3. Verify transcript was saved to DB
  console.log("\n3. Verifying transcript saved to DB...")
  const chatAfter1 = await db
    .select({
      sdkSessionId: chats.sdkSessionId,
      sdkTranscript: chats.sdkTranscript,
    })
    .from(chats)
    .where(eq(chats.id, chatId))
    .then(rows => rows[0])

  if (chatAfter1?.sdkTranscript) {
    console.log(`   ✅ Transcript saved (${chatAfter1.sdkTranscript.length} bytes)`)
    console.log(`   First 200 chars: ${chatAfter1.sdkTranscript.substring(0, 200)}...`)
  } else {
    console.log("   ❌ Transcript NOT saved to DB!")
    process.exit(1)
  }

  // 4. Delete the transcript FILE (simulating dyno restart)
  console.log("\n4. Deleting transcript FILE (simulating restart)...")
  const transcriptPath = getTranscriptPath(result1.sdkSessionId)
  if (existsSync(transcriptPath)) {
    unlinkSync(transcriptPath)
    console.log(`   Deleted: ${transcriptPath}`)
  } else {
    console.log(`   File was already gone: ${transcriptPath}`)
  }

  // 5. Send follow-up message (should restore from DB)
  console.log("\n5. Sending follow-up (should restore transcript from DB)...")
  const result2 = await agentSession.runTurn(chatId, "What is my secret code?")
  const text2 = extractText(result2.contentBlocks)
  console.log(`   SDK Session: ${result2.sdkSessionId}`)
  console.log(`   Response: ${text2}`)

  // 6. Check if Claude remembered
  const rememberedSecret =
    text2.toLowerCase().includes("mango") || text2.includes("MANGO456")

  if (rememberedSecret) {
    console.log("\n✅ SUCCESS! Claude remembered the secret after 'restart'")
  } else {
    console.log("\n❌ FAILURE! Claude did not remember the secret")
    console.log("   This means transcript restore is not working correctly")
  }

  // 7. Clean up
  console.log("\n7. Cleaning up test data...")
  await db.delete(messages).where(eq(messages.chatId, chatId))
  await db.delete(chats).where(eq(chats.id, chatId))
  console.log("   Deleted test chat and messages")

  console.log("\n🧪 Test complete!")
}

main().catch(console.error)
