"use client"

/**
 * Chat Runtime Provider
 *
 * Integrates assistant-ui with our tRPC backend.
 * Uses ExternalStoreRuntime to provide a custom data source.
 */

import { ReactNode, useMemo, useEffect, useRef } from "react"
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  type ThreadMessageLike,
} from "@assistant-ui/react"
import { trpc } from "@/lib/trpc/client"
import { useChatStream } from "@/hooks/useChatStream"
import { convertMessage, convertStreamingMessage } from "@/lib/chat/messageConverter"
import { ChatStreamProvider } from "./ChatStreamContext"

interface ChatRuntimeProviderProps {
  chatId: string
  children: ReactNode
}

export function ChatRuntimeProvider({ chatId, children }: ChatRuntimeProviderProps) {
  // Fetch persisted messages
  const { data: dbMessages = [], isLoading: isLoadingMessages } = trpc.chat.getMessages.useQuery(chatId)

  // Streaming state
  const { sendMessage, triggerOpening, isStreaming, streamingMessage, error } = useChatStream(chatId)

  // Auto-trigger opening message for new chats (no messages yet)
  const hasTriggeredOpening = useRef(false)
  useEffect(() => {
    if (!isLoadingMessages && dbMessages.length === 0 && !hasTriggeredOpening.current && !isStreaming) {
      hasTriggeredOpening.current = true
      triggerOpening()
    }
  }, [isLoadingMessages, dbMessages.length, isStreaming, triggerOpening])

  // Convert messages to assistant-ui format
  const messages = useMemo((): ThreadMessageLike[] => {
    // Convert persisted messages
    const converted = dbMessages.map(convertMessage)

    // Add streaming message if present
    if (streamingMessage && !streamingMessage.isComplete) {
      converted.push(convertStreamingMessage(streamingMessage))
    }

    return converted
  }, [dbMessages, streamingMessage])

  // Create the runtime using external store
  const runtime = useExternalStoreRuntime({
    isRunning: isStreaming,
    messages,
    convertMessage: (msg: ThreadMessageLike) => msg,
    onNew: async message => {
      // Extract text from the message
      const text =
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((part): part is { type: "text"; text: string } => part.type === "text")
              .map(part => part.text)
              .join("\n")

      if (text.trim()) {
        sendMessage(text)
      }
    },
    onCancel: async () => {
      // TODO: Implement cancel functionality
      console.log("Cancel requested - not yet implemented")
    },
  })

  const isCompacting = streamingMessage?.isCompacting ?? false

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatStreamProvider isCompacting={isCompacting}>
        {children}
        {/* Surface errors to children via context if needed */}
        {error && (
          <div className="hidden" data-chat-error={error} />
        )}
      </ChatStreamProvider>
    </AssistantRuntimeProvider>
  )
}
