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

// Streaming parts - maintains order as content streams in
type StreamingPart =
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "tool"; toolUseId: string; toolName: string; argsText: string; result?: string; elapsedSeconds?: number; isComplete: boolean }

interface StreamingMessage {
  id: string
  parts: StreamingPart[]
  contentBlocks: ContentBlock[]
  isComplete: boolean
  isCompacting: boolean
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

  // Opening message subscription (separate from regular messages)
  const [openingInput, setOpeningInput] = useState<typeof skipToken | string>(skipToken)

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
            parts: [],
            contentBlocks: [],
            isComplete: false,
            isCompacting: false,
          })
          break

        case "text_delta":
          // If last part is text, update it; otherwise add new text part
          setStreamingMessage(prev => {
            if (!prev) return prev
            const parts = [...prev.parts]
            const lastPart = parts[parts.length - 1]
            if (lastPart?.type === "text") {
              parts[parts.length - 1] = { type: "text", text: event.text }
            } else {
              parts.push({ type: "text", text: event.text })
            }
            return { ...prev, parts }
          })
          break

        case "thinking_delta":
          // If last part is thinking, update it; otherwise add new thinking part
          setStreamingMessage(prev => {
            if (!prev) return prev
            const parts = [...prev.parts]
            const lastPart = parts[parts.length - 1]
            if (lastPart?.type === "thinking") {
              parts[parts.length - 1] = { type: "thinking", text: event.thinking }
            } else {
              parts.push({ type: "thinking", text: event.thinking })
            }
            return { ...prev, parts }
          })
          break

        case "tool_start":
          setStreamingMessage(prev =>
            prev
              ? {
                  ...prev,
                  parts: [
                    ...prev.parts,
                    { type: "tool", toolUseId: event.toolUseId, toolName: event.toolName, argsText: "", isComplete: false },
                  ],
                }
              : prev,
          )
          break

        case "tool_input_delta":
          setStreamingMessage(prev => {
            if (!prev) return prev
            const parts = prev.parts.map(p =>
              p.type === "tool" && p.toolUseId === event.toolUseId
                ? { ...p, argsText: event.argsText }
                : p,
            )
            return { ...prev, parts }
          })
          break

        case "tool_progress":
          setStreamingMessage(prev => {
            if (!prev) return prev
            const parts = prev.parts.map(p =>
              p.type === "tool" && p.toolUseId === event.toolUseId
                ? { ...p, elapsedSeconds: event.elapsedSeconds }
                : p,
            )
            return { ...prev, parts }
          })
          break

        case "tool_result":
          // Mark tool as complete and store result
          setStreamingMessage(prev => {
            if (!prev) return prev
            const parts = prev.parts.map(p =>
              p.type === "tool" && p.toolUseId === event.toolUseId
                ? { ...p, isComplete: true, result: event.summary }
                : p,
            )
            return { ...prev, parts }
          })
          break

        case "compact_start":
          setStreamingMessage(prev =>
            prev ? { ...prev, isCompacting: true } : prev,
          )
          break

        case "compact_complete":
          setStreamingMessage(prev =>
            prev ? { ...prev, isCompacting: false } : prev,
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
          setOpeningInput(skipToken)
          setStreamingMessage(null)
          break

        case "error":
          setError(event.error)
          setIsStreaming(false)
          setSubscriptionInput(skipToken)
          setOpeningInput(skipToken)
          setStreamingMessage(null)
          break
      }
    },
    [chatId, utils],
  )

  // Subscribe to regular message stream
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

  // Subscribe to opening message stream (shares same event handler)
  trpc.chat.sendOpeningMessage.useSubscription(openingInput, {
    onData: handleStreamEvent,
    onError: err => {
      setError(err.message)
      setIsStreaming(false)
      setOpeningInput(skipToken)
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

  // Trigger opening message (Claude speaks first)
  const triggerOpening = useCallback(() => {
    if (isStreaming) return
    setOpeningInput(chatId)
  }, [chatId, isStreaming])

  return {
    sendMessage,
    triggerOpening,
    isStreaming,
    streamingMessage,
    error,
  }
}
