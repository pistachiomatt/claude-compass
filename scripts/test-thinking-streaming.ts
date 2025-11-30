/**
 * Test streaming with extended thinking
 * Run with: npx tsx scripts/test-thinking-streaming.ts
 */

import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { db } from "../db"
import { chats, messages, MessageRole } from "../db/schema"
import getUuid from "../lib/utils/getUuid"
import { eq } from "drizzle-orm"

// Direct SDK call to test thinking
async function main() {
  console.log("🧪 Testing streaming with extended thinking...\n")

  const { query } = await import("@anthropic-ai/claude-agent-sdk")

  const chatId = getUuid()
  await db.insert(chats).values({ id: chatId, name: "Thinking Test" })

  const tempPath = `/tmp/compass/${chatId}`
  const fs = await import("fs")
  fs.mkdirSync(tempPath, { recursive: true })

  console.log("Streaming events:")
  const response = query({
    prompt: "What is 15 * 23? Think through this step by step.",
    options: {
      cwd: tempPath,
      maxTurns: 1,
      allowedTools: [],
      permissionMode: "bypassPermissions",
      includePartialMessages: true,
      maxThinkingTokens: 5000,
    },
  })

  for await (const message of response) {
    if (message.type === "stream_event" && "event" in message) {
      const event = message.event as { type: string; delta?: { type: string; text?: string; thinking?: string } }
      if (event.type === "content_block_delta") {
        if (event.delta?.type === "text_delta" && event.delta.text) {
          console.log(`  text_delta: "${event.delta.text.slice(0, 40)}..."`)
        }
        if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
          console.log(`  thinking_delta: "${event.delta.thinking.slice(0, 40)}..."`)
        }
        // Check for other delta types
        if (event.delta?.type && !["text_delta", "thinking_delta"].includes(event.delta.type)) {
          console.log(`  unknown delta: ${event.delta.type}`)
        }
      }
    }
    if (message.type === "assistant") {
      console.log("\nFinal content blocks:")
      for (const block of message.message.content) {
        console.log(`  - ${block.type}`)
      }
    }
  }

  // Cleanup
  await db.delete(chats).where(eq(chats.id, chatId))
  fs.rmSync(tempPath, { recursive: true, force: true })
  console.log("\n✅ Done!")
}

main().catch(console.error)
