import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { db } from "../db"
import { chats, messages, MessageRole } from "../db/schema"
import getUuid from "../lib/utils/getUuid"
import { agentSession } from "../lib/agent/agentSession"
import { eq } from "drizzle-orm"

/**
 * Test that contentBlocks accumulated during streaming match
 * what's persisted to the database.
 *
 * This validates the fix for tool_use and thinking blocks disappearing.
 */
async function main() {
  console.log("🧪 Testing contentBlocks accumulation during streaming...\n")

  const chatId = getUuid()
  await db.insert(chats).values({ id: chatId, name: "ContentBlocks Accumulation Test" })

  const prompt = `Do some thinking about this task first.
Then write some text explaining what you're about to do.
Then write a sample file called sample.md to the filesystem with some content.
Then think some more about what you wrote.
Then update the file sample.md with additional content.
Finally, respond in text explaining what you did.`

  // Pre-create user message (as required by runTurnStream)
  await db.insert(messages).values({
    chatId,
    role: MessageRole.USER,
    contentBlocks: [{ type: "text", text: prompt }],
  })

  // Track streaming events
  const streamedEvents: Array<{ type: string; data?: unknown }> = []
  let finalContentBlocks: unknown[] = []
  let finalMessageId = ""

  console.log("📡 Streaming events:")
  console.log("─".repeat(60))

  for await (const event of agentSession.runTurnStream(chatId, prompt, {
    maxThinkingTokens: 1024,
  })) {
    streamedEvents.push({ type: event.type, data: event })

    switch (event.type) {
      case "init":
        console.log(`  init: messageId=${event.messageId}`)
        finalMessageId = event.messageId
        break
      case "thinking_delta":
        console.log(`  thinking_delta: "${event.delta.slice(0, 50)}..."`)
        break
      case "text_delta":
        console.log(`  text_delta: "${event.delta.slice(0, 50)}..."`)
        break
      case "tool_start":
        console.log(`  tool_start: ${event.toolName} (${event.toolUseId})`)
        break
      case "tool_progress":
        console.log(`  tool_progress: ${event.toolName} (${event.elapsedSeconds}s)`)
        break
      case "tool_result":
        console.log(`  tool_result: ${event.toolUseId} ${event.isError ? "❌" : "✓"}`)
        break
      case "message_complete":
        console.log(`  message_complete: ${event.contentBlocks.length} blocks`)
        finalContentBlocks = event.contentBlocks
        break
      case "done":
        console.log(`  done`)
        break
      case "error":
        console.log(`  error: ${event.error}`)
        break
    }
  }

  console.log("─".repeat(60))

  // Fetch the persisted message from DB
  const persistedMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      contentBlocks: messages.contentBlocks,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt)

  const assistantMessage = persistedMessages.find((m) => m.role === MessageRole.ASSISTANT)

  console.log("\n📊 Results:")
  console.log("─".repeat(60))

  // Count block types in final accumulated blocks
  const countByType = (blocks: unknown[]) => {
    const counts: Record<string, number> = {}
    for (const block of blocks) {
      const type = (block as { type: string }).type
      counts[type] = (counts[type] || 0) + 1
    }
    return counts
  }

  const streamedCounts = countByType(finalContentBlocks)
  console.log("\n🔄 Streamed contentBlocks (from message_complete):")
  console.log(`   Total: ${finalContentBlocks.length} blocks`)
  console.log(`   By type:`, streamedCounts)

  if (assistantMessage) {
    const persistedBlocks = assistantMessage.contentBlocks as unknown[]
    const persistedCounts = countByType(persistedBlocks)
    console.log("\n💾 Persisted contentBlocks (from DB):")
    console.log(`   Total: ${persistedBlocks.length} blocks`)
    console.log(`   By type:`, persistedCounts)

    // Verify they match
    const streamed = JSON.stringify(finalContentBlocks)
    const persisted = JSON.stringify(persistedBlocks)
    const match = streamed === persisted

    console.log("\n✅ Match:", match ? "YES - streamed equals persisted!" : "NO - MISMATCH!")

    if (!match) {
      console.log("\n⚠️  Streamed blocks:")
      for (const block of finalContentBlocks) {
        const b = block as { type: string; name?: string; id?: string }
        console.log(`   - ${b.type}${b.name ? `: ${b.name}` : ""}${b.id ? ` (${b.id})` : ""}`)
      }
      console.log("\n⚠️  Persisted blocks:")
      for (const block of persistedBlocks) {
        const b = block as { type: string; name?: string; id?: string }
        console.log(`   - ${b.type}${b.name ? `: ${b.name}` : ""}${b.id ? ` (${b.id})` : ""}`)
      }
    }

    // Check for specific block types we expect
    console.log("\n🔍 Expected block types present:")
    console.log(`   thinking:    ${persistedCounts["thinking"] ? "✓" : "✗"} (${persistedCounts["thinking"] || 0})`)
    console.log(`   text:        ${persistedCounts["text"] ? "✓" : "✗"} (${persistedCounts["text"] || 0})`)
    console.log(`   tool_use:    ${persistedCounts["tool_use"] ? "✓" : "✗"} (${persistedCounts["tool_use"] || 0})`)
    console.log(`   tool_result: ${persistedCounts["tool_result"] ? "✓" : "✗"} (${persistedCounts["tool_result"] || 0})`)
  } else {
    console.log("\n❌ No assistant message found in DB!")
  }

  // Cleanup
  await db.delete(messages).where(eq(messages.chatId, chatId))
  await db.delete(chats).where(eq(chats.id, chatId))

  console.log("\n🧹 Cleaned up test data")
  console.log("─".repeat(60))
}

main().catch(console.error)
