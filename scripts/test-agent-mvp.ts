/**
 * Quick test script for Agent SDK MVP
 * Run with: npx tsx scripts/test-agent-mvp.ts
 */

import { db } from "../db"
import { chats, messages } from "../db/schema"
import { agentSession } from "../lib/agent/agentSession"
import { eq } from "drizzle-orm"

async function main() {
  console.log("🧪 Testing Agent SDK MVP...\n")

  // 1. Create a test chat
  console.log("1. Creating test chat...")
  const [chat] = await db.insert(chats).values({ name: "Agent MVP Test" }).returning()
  console.log(`   Created chat: ${chat.id}\n`)

  // 2. Send a message
  console.log("2. Sending message to agent...")
  const userMessage = "What is 2 + 2? Please respond with just the number."

  try {
    const result = await agentSession.runTurn(chat.id, userMessage)

    console.log("\n✅ Agent responded!")
    console.log(`   Content: ${result.content}`)
    console.log(`   SDK Session ID: ${result.sdkSessionId}`)
    if (result.usage) {
      console.log(`   Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`)
      console.log(`   Cost: $${result.usage.totalCostUsd.toFixed(4)}`)
    }

    // 3. Verify messages in DB
    console.log("\n3. Verifying messages in database...")
    const storedMessages = await agentSession.getMessages(chat.id)
    console.log(`   Found ${storedMessages.length} messages:`)
    for (const msg of storedMessages) {
      console.log(`   - [${msg.role}]: ${msg.content?.substring(0, 50)}...`)
    }

    // 4. Verify chat has SDK session ID
    const updatedChat = await db
      .select({ sdkSessionId: chats.sdkSessionId })
      .from(chats)
      .where(eq(chats.id, chat.id))
      .then(rows => rows[0])
    console.log(`\n4. Chat SDK session ID stored: ${updatedChat?.sdkSessionId ? "✅" : "❌"}`)

    console.log("\n🎉 MVP test complete!")
  } catch (error) {
    console.error("\n❌ Error:", error)
    process.exit(1)
  } finally {
    // Cleanup: delete test chat and messages
    console.log("\n5. Cleaning up test data...")
    await db.delete(messages).where(eq(messages.chatId, chat.id))
    await db.delete(chats).where(eq(chats.id, chat.id))
    console.log("   Done!")
    process.exit(0)
  }
}

main()
