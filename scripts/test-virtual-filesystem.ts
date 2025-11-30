/**
 * Test the virtual filesystem flow
 *
 * This simulates:
 * 1. Create a chat
 * 2. Ask Claude to create a markdown file
 * 3. Verify the file is synced to DB
 * 4. Delete the temp directory (simulating process restart)
 * 5. Send a follow-up message asking Claude to read the file
 * 6. Verify Claude can still read the file (restored from DB)
 *
 * Run with: npx tsx scripts/test-virtual-filesystem.ts
 */

import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { db } from "../db"
import { chats, messages, type ContentBlock, type VirtualFiles } from "../db/schema"
import getUuid from "../lib/utils/getUuid"
import { agentSession } from "../lib/agent/agentSession"
import { existsSync, rmSync } from "fs"
import { eq } from "drizzle-orm"
import { getTempPath } from "../lib/agent/utils/virtualFilesystem"

// Extract text from content blocks
function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text)
    .join("\n")
}

async function main() {
  console.log("🧪 Testing virtual filesystem flow...\n")

  // 1. Create a test chat
  console.log("1. Creating test chat...")
  const chatId = getUuid()
  await db.insert(chats).values({
    id: chatId,
    name: "Virtual Filesystem Test",
  })
  console.log(`   Chat ID: ${chatId}`)

  // 2. Ask Claude to create a file
  console.log("\n2. Asking Claude to create a file...")
  const result1 = await agentSession.runTurn(
    chatId,
    "Please create a file called notes.md with the content: '# My Notes\n\nThe secret password is TIGER789'",
  )
  const text1 = extractText(result1.contentBlocks)
  console.log(`   Response: ${text1.substring(0, 200)}...`)

  // 3. Verify file is synced to DB
  console.log("\n3. Verifying file synced to DB...")
  const chatAfter1 = await db
    .select({
      files: chats.files,
    })
    .from(chats)
    .where(eq(chats.id, chatId))
    .then(rows => rows[0])

  const files = chatAfter1?.files as VirtualFiles | null
  if (files && Object.keys(files).length > 0) {
    console.log(`   ✅ Files in DB: ${Object.keys(files).join(", ")}`)
    for (const [path, file] of Object.entries(files)) {
      console.log(`   - ${path}: ${file.content.substring(0, 50)}...`)
    }
  } else {
    console.log("   ❌ No files synced to DB!")
    process.exit(1)
  }

  // 4. Delete temp directory (simulate restart)
  console.log("\n4. Deleting temp directory (simulating restart)...")
  const tempPath = getTempPath(chatId)
  if (existsSync(tempPath)) {
    rmSync(tempPath, { recursive: true })
    console.log(`   Deleted: ${tempPath}`)
  } else {
    console.log(`   Temp dir was already gone: ${tempPath}`)
  }

  // 5. Ask Claude to read the file
  console.log("\n5. Asking Claude to read the file (should restore from DB)...")
  const result2 = await agentSession.runTurn(
    chatId,
    "What is the secret password in notes.md?",
  )
  const text2 = extractText(result2.contentBlocks)
  console.log(`   Response: ${text2}`)

  // 6. Verify Claude remembered
  const rememberedPassword =
    text2.toLowerCase().includes("tiger") || text2.includes("TIGER789")

  if (rememberedPassword) {
    console.log("\n✅ SUCCESS! Claude could read the file after 'restart'")
  } else {
    console.log("\n❌ FAILURE! Claude could not read the file")
    console.log("   This means virtual filesystem restore is not working correctly")
  }

  // 7. Clean up
  console.log("\n7. Cleaning up test data...")
  await db.delete(messages).where(eq(messages.chatId, chatId))
  await db.delete(chats).where(eq(chats.id, chatId))
  // Clean up temp dir if it exists
  if (existsSync(tempPath)) {
    rmSync(tempPath, { recursive: true })
  }
  console.log("   Deleted test chat and messages")

  console.log("\n🧪 Test complete!")
}

main().catch(console.error)
