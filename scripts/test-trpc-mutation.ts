/**
 * Test calling the non-streaming mutation directly
 * to verify SDK works in server context
 *
 * Run with: npx tsx scripts/test-trpc-mutation.ts
 */

import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { db } from "../db"
import { chats, messages } from "../db/schema"
import getUuid from "../lib/utils/getUuid"
import { agentSession } from "../lib/agent/agentSession"
import { eq } from "drizzle-orm"

async function main() {
  console.log("🧪 Testing non-streaming runTurn (same as mutation)...\n")

  // 1. Create a test chat
  console.log("1. Creating test chat...")
  const chatId = getUuid()
  await db.insert(chats).values({
    id: chatId,
    name: "Mutation Test",
  })
  console.log(`   Chat ID: ${chatId}`)

  // 2. Test runTurn (non-streaming)
  console.log("\n2. Testing runTurn...")
  try {
    const result = await agentSession.runTurn(chatId, "Say hello briefly")
    console.log(`   Success! Got ${result.contentBlocks.length} content blocks`)
    console.log(`   Session: ${result.sdkSessionId}`)
  } catch (error) {
    console.error("\n❌ runTurn failed:", error)
  }

  // 3. Clean up
  console.log("\n3. Cleaning up...")
  await db.delete(messages).where(eq(messages.chatId, chatId))
  await db.delete(chats).where(eq(chats.id, chatId))
  console.log("   Done!")

  console.log("\n🧪 Test complete!")
}

main().catch(console.error)
