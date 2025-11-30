/**
 * Chat Streaming Hook
 *
 * Manages streaming chat messages using tRPC subscriptions.
 * Uses the skipToken pattern to control subscription lifecycle.
 */

import { useState, useCallback } from "react"
import { trpc } from "@/lib/trpc/client"
import { skipToken } from "@tanstack/react-query"
import type { StreamEvent } from "@/lib/agent/streamTypes"
import type { ContentBlock } from "@/db/schema"

interface ActiveTool {
  toolUseId: string
  toolName: string
  elapsedSeconds?: number
}

interface StreamingMessage {
  id: string
  text: string
  thinking: string
  contentBlocks: ContentBlock[]
  isComplete: boolean
  activeTools: ActiveTool[]
}

interface SendMessageInput {
  chatId: string
  content: string
}

export function useChatStream(chatId: string) {
  const utils = trpc.useUtils()

  // Subscription input state (skipToken = not subscribed)
  const [subscriptionInput, setSubscriptionInput] = useState<
    typeof skipToken | SendMessageInput
  >(skipToken)

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Handle stream events
  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      switch (event.type) {
        case "init":
          setStreamingMessage({
            id: event.messageId,
            text: "",
            thinking: "",
            contentBlocks: [],
            isComplete: false,
            activeTools: [],
          })
          break

        case "text_delta":
          setStreamingMessage(prev =>
            prev ? { ...prev, text: event.text } : prev,
          )
          break

        case "thinking_delta":
          setStreamingMessage(prev =>
            prev ? { ...prev, thinking: event.thinking } : prev,
          )
          break

        case "tool_start":
          setStreamingMessage(prev =>
            prev
              ? {
                  ...prev,
                  activeTools: [
                    ...prev.activeTools,
                    { toolUseId: event.toolUseId, toolName: event.toolName },
                  ],
                }
              : prev,
          )
          break

        case "tool_progress":
          setStreamingMessage(prev =>
            prev
              ? {
                  ...prev,
                  activeTools: prev.activeTools.map(t =>
                    t.toolUseId === event.toolUseId
                      ? { ...t, elapsedSeconds: event.elapsedSeconds }
                      : t,
                  ),
                }
              : prev,
          )
          break

        case "tool_result":
          // Remove completed tool from active list
          setStreamingMessage(prev =>
            prev
              ? {
                  ...prev,
                  activeTools: prev.activeTools.filter(t => t.toolUseId !== event.toolUseId),
                }
              : prev,
          )
          break

        case "message_complete":
          setStreamingMessage(prev =>
            prev
              ? { ...prev, contentBlocks: event.contentBlocks, isComplete: true }
              : prev,
          )
          // Refetch messages to get the persisted version
          utils.chat.getMessages.invalidate(chatId)
          break

        case "done":
          setIsStreaming(false)
          setSubscriptionInput(skipToken)
          setStreamingMessage(null)
          break

        case "error":
          setError(event.error)
          setIsStreaming(false)
          setSubscriptionInput(skipToken)
          setStreamingMessage(null)
          break
      }
    },
    [chatId, utils],
  )

  // Subscribe to stream
  trpc.chat.sendMessageStream.useSubscription(subscriptionInput, {
    onData: handleStreamEvent,
    onError: err => {
      setError(err.message)
      setIsStreaming(false)
      setSubscriptionInput(skipToken)
      setStreamingMessage(null)
    },
    onStarted: () => {
      setIsStreaming(true)
      setError(null)
    },
  })

  // Send a new message
  const sendMessage = useCallback(
    (content: string) => {
      if (isStreaming) return

      // Optimistically add user message to cache
      utils.chat.getMessages.setData(chatId, old => {
        if (!old) return old
        return [
          ...old,
          {
            id: `temp-${Date.now()}`,
            role: "user",
            contentBlocks: [{ type: "text" as const, text: content }],
            createdAt: new Date(),
          },
        ]
      })

      // Start subscription
      setSubscriptionInput({ chatId, content })
    },
    [chatId, isStreaming, utils],
  )

  return {
    sendMessage,
    isStreaming,
    streamingMessage,
    error,
  }
}
