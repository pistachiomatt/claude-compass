"use client"

import { useMemo } from "react"
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react"
import { Thread } from "@/components/assistant-ui/thread"
import { Button } from "@/components/ui/button"
import { ChatStreamProvider } from "@/components/chat/ChatStreamContext"
import { convertStreamingMessage } from "@/lib/chat/messageConverter"
import { type DemoPersistedMessage, useDemoStreamController } from "@/hooks/useDemoStreamController"

const toThreadMessage = (msg: DemoPersistedMessage): ThreadMessageLike => ({
  id: msg.id,
  role: msg.role,
  content: msg.content,
  status:
    msg.role === "assistant" ? { type: "complete" as const, reason: "stop" as const } : undefined,
})

export function DemoChatContainer() {
  const controller = useDemoStreamController()

  const threadMessages = useMemo((): ThreadMessageLike[] => {
    const converted = controller.messages.map(toThreadMessage)

    if (controller.streamingMessage && !controller.streamingMessage.isComplete) {
      converted.push(convertStreamingMessage(controller.streamingMessage))
    }

    return converted
  }, [controller.messages, controller.streamingMessage])

  const runtime = useExternalStoreRuntime({
    isRunning: controller.isStreaming,
    messages: threadMessages,
    convertMessage: (msg: ThreadMessageLike) => msg,
    onNew: async () => {
      // Ignore composer input in demo mode; use the control panel instead
    },
    onCancel: controller.cancel,
  })

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="border-b px-4 py-3 flex gap-2 flex-wrap">
        <Button onClick={controller.addUserTurn} variant="outline" size="sm">
          Add user turn
        </Button>
        <Button onClick={controller.streamThinking} variant="outline" size="sm">
          Stream thinking
        </Button>
        <Button onClick={controller.streamResponse} variant="outline" size="sm">
          Stream response
        </Button>
        <Button onClick={controller.streamToolCall} variant="outline" size="sm">
          Stream tool call
        </Button>
        <Button
          onClick={controller.finishMessage}
          variant="outline"
          size="sm"
          disabled={!controller.streamingMessage}
        >
          Finish message
        </Button>
        <Button onClick={controller.clear} variant="destructive" size="sm">
          Clear
        </Button>
      </div>

      <AssistantRuntimeProvider runtime={runtime}>
        <ChatStreamProvider isCompacting={controller.isCompacting}>
          <div className="flex-1 min-h-0 flex flex-col">
            <Thread />
          </div>
        </ChatStreamProvider>
      </AssistantRuntimeProvider>
    </div>
  )
}
