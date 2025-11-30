/**
 * Test the streaming flow directly (bypassing tRPC)
 *
 * This helps isolate whether the issue is:
 * 1. SDK configuration
 * 2. Streaming implementation
 * 3. tRPC subscription layer
 *
 * Run with: npx tsx scripts/test-streaming.ts
 */

import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { db } from "../db"
import { chats, messages, MessageRole } from "../db/schema"
import getUuid from "../lib/utils/getUuid"
import { agentSession } from "../lib/agent/agentSession"
import { eq } from "drizzle-orm"

async function main() {
  console.log("🧪 Testing streaming flow...\n")

  // 1. Create a test chat
  console.log("1. Creating test chat...")
  const chatId = getUuid()
  await db.insert(chats).values({
    id: chatId,
    name: "Streaming Test",
  })
  console.log(`   Chat ID: ${chatId}`)

  // 2. Save user message (like the router does)
  console.log("\n2. Saving user message...")
  const userContent = "Hello! Please respond with a short greeting."
  await db.insert(messages).values({
    chatId,
    role: MessageRole.USER,
    contentBlocks: [{ type: "text", text: userContent }],
  })
  console.log(`   Saved: "${userContent}"`)

  // 3. Test streaming
  console.log("\n3. Testing runTurnStream...")
  try {
    let eventCount = 0
    for await (const event of agentSession.runTurnStream(chatId, userContent)) {
      eventCount++
      console.log(`   Event ${eventCount}: ${event.type}`,
        event.type === "text_delta" ? `"${event.delta.substring(0, 30)}..."` : ""
      )

      if (event.type === "error") {
        console.log(`   ERROR: ${event.error}`)
        break
      }

      if (event.type === "message_complete") {
        console.log(`   Complete! ${event.contentBlocks.length} blocks`)
      }
    }
    console.log(`   Total events: ${eventCount}`)
  } catch (error) {
    console.error("\n❌ Streaming failed:", error)
  }

  // 4. Check messages in DB
  console.log("\n4. Checking messages in DB...")
  const savedMessages = await db
    .select({
      role: messages.role,
      contentBlocks: messages.contentBlocks,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))

  console.log(`   Found ${savedMessages.length} messages`)
  for (const msg of savedMessages) {
    console.log(`   - ${msg.role}: ${JSON.stringify(msg.contentBlocks).substring(0, 100)}...`)
  }

  // 5. Clean up
  console.log("\n5. Cleaning up...")
  await db.delete(messages).where(eq(messages.chatId, chatId))
  await db.delete(chats).where(eq(chats.id, chatId))
  console.log("   Done!")

  console.log("\n🧪 Test complete!")
}

main().catch(console.error)
