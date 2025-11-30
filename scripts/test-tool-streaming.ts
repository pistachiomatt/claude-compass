import { setupVertexAuth } from "../lib/agent/utils/setupVertexAuth"
setupVertexAuth()

import { db } from "../db"
import { chats, messages, MessageRole } from "../db/schema"
import getUuid from "../lib/utils/getUuid"
import { agentSession } from "../lib/agent/agentSession"
import { eq } from "drizzle-orm"

async function main() {
  console.log("🧪 Testing streaming with tool use...\n")

  const chatId = getUuid()
  await db.insert(chats).values({ id: chatId, name: "Tool Test" })

  await db.insert(messages).values({
    chatId,
    role: MessageRole.USER,
    contentBlocks: [
      { type: "text", text: "Create a file called hello.md with the text 'Hello World'" },
    ],
  })

  console.log("Streaming events:")
  for await (const event of agentSession.runTurnStream(
    chatId,
    "Create a file called hello.md with the text 'Hello World'",
  )) {
    console.log(
      `  ${event.type}`,
      event.type === "text_delta"
        ? `"${event.delta.slice(0, 30)}..."`
        : event.type === "tool_start"
          ? `${event.toolName}`
          : event.type === "tool_progress"
            ? `${event.toolName} (${event.elapsedSeconds}s)`
            : "",
    )
  }

  // Cleanup
  await db.delete(messages).where(eq(messages.chatId, chatId))
  await db.delete(chats).where(eq(chats.id, chatId))
  console.log("\n✅ Done!")
}

main().catch(console.error)
