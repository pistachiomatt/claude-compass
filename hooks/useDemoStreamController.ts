"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReadonlyJSONObject } from "assistant-stream/utils"
import type { StreamEvent } from "@/lib/agent/streamTypes"
import type { StreamingMessageState } from "@/lib/chat/messageConverter"
import getUuid from "@/lib/utils/getUuid"

type StreamingPart = StreamingMessageState["parts"][number]

export type DemoMessageContent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | {
      type: "tool-call"
      toolCallId: string
      toolName: string
      args: ReadonlyJSONObject
      argsText: string
      result?: string
    }

export interface DemoPersistedMessage {
  id: string
  role: "user" | "assistant"
  content: DemoMessageContent[]
}

interface DemoStreamController {
  messages: DemoPersistedMessage[]
  streamingMessage: StreamingMessageState | null
  isStreaming: boolean
  isCompacting: boolean
  addUserTurn: () => void
  streamThinking: () => void
  streamResponse: () => void
  streamToolCall: () => void
  finishMessage: () => void
  clear: () => void
  cancel: () => void
}

const THINKING_SAMPLES = [
  "Let me think about this carefully... I need to consider the implications here. This is an interesting problem. I should break this down step by step. ".repeat(
    10,
  ),
] as const

const RESPONSE_SAMPLES = [
  "Here's what I found: the solution involves several key steps.",
  "Based on my analysis, there are three main approaches we could take.",
  "The answer depends on your specific requirements and constraints.",
  "I've examined the code and identified a few areas for improvement.",
] as const

const TOOL_NAMES = ["search_web", "read_file", "execute_code", "analyze_data"] as const

const TOOL_INPUT = { query: "example search", limit: 10 }

const TOOL_RESULT_SUMMARY = "Tool executed successfully. Found 5 results."

const randomItem = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

const convertPartsToPersistedContent = (parts: StreamingPart[]): DemoMessageContent[] =>
  parts.map(part => {
    switch (part.type) {
      case "thinking":
        return { type: "reasoning", text: part.text }
      case "text":
        return { type: "text", text: part.text }
      case "tool":
        return {
          type: "tool-call",
          toolCallId: part.toolUseId,
          toolName: part.toolName,
          args: {} as ReadonlyJSONObject,
          argsText: part.argsText,
          ...(part.result !== undefined && { result: part.result }),
        }
    }
  })

export function useDemoStreamController(): DemoStreamController {
  const [messages, setMessages] = useState<DemoPersistedMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessageState | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingMessageRef = useRef<StreamingMessageState | null>(null)

  useEffect(() => {
    streamingMessageRef.current = streamingMessage
  }, [streamingMessage])

  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stopTimers = useCallback(() => {
    clearIntervalRef()
    clearTimeoutRef()
  }, [clearIntervalRef, clearTimeoutRef])

  useEffect(() => () => stopTimers(), [stopTimers])

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      switch (event.type) {
        case "init":
          setIsStreaming(true)
          setStreamingMessage({
            id: event.messageId,
            parts: [],
            isComplete: false,
            isCompacting: false,
          })
          break

        case "text_delta":
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
                    {
                      type: "tool",
                      toolUseId: event.toolUseId,
                      toolName: event.toolName,
                      argsText: "",
                      isComplete: false,
                    },
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
          setIsCompacting(true)
          setStreamingMessage(prev => (prev ? { ...prev, isCompacting: true } : prev))
          break

        case "compact_complete":
          setIsCompacting(false)
          setStreamingMessage(prev => (prev ? { ...prev, isCompacting: false } : prev))
          break

        case "message_complete":
          setStreamingMessage(prev => (prev ? { ...prev, isComplete: true } : prev))
          break

        case "done":
          stopTimers()
          setIsStreaming(false)
          setIsCompacting(false)
          setStreamingMessage(prev => {
            if (!prev || prev.parts.length === 0) {
              return null
            }
            const content = convertPartsToPersistedContent(prev.parts)
            setMessages(msgs => [...msgs, { id: prev.id, role: "assistant", content }])
            return null
          })
          break

        case "error":
          stopTimers()
          setIsStreaming(false)
          setIsCompacting(false)
          setStreamingMessage(null)
          break

        default:
          break
      }
    },
    [stopTimers],
  )

  const ensureStreamingMessage = useCallback(() => {
    if (!streamingMessageRef.current) {
      handleStreamEvent({ type: "init", messageId: getUuid(), sdkSessionId: "demo-session" })
    }
  }, [handleStreamEvent])

  const startWordStream = useCallback(
    (text: string, kind: "thinking" | "text") => {
      if (!text) return
      stopTimers()
      ensureStreamingMessage()

      const words = text.split(" ")
      let index = 0
      let buffered = ""

      intervalRef.current = setInterval(() => {
        const chunk = words.slice(index, index + 4).join(" ")
        index += 4

        if (index >= words.length) {
          buffered = text
        } else {
          buffered = buffered ? `${buffered} ${chunk}` : chunk
        }

        if (kind === "thinking") {
          handleStreamEvent({ type: "thinking_delta", delta: chunk, thinking: buffered })
        } else {
          handleStreamEvent({ type: "text_delta", delta: chunk, text: buffered })
        }

        if (index >= words.length) {
          clearIntervalRef()
        }
      }, 120)
    },
    [clearIntervalRef, ensureStreamingMessage, handleStreamEvent, stopTimers],
  )

  const streamToolCall = useCallback(() => {
    stopTimers()
    ensureStreamingMessage()

    const toolUseId = getUuid()
    const toolName = randomItem(TOOL_NAMES)
    handleStreamEvent({ type: "tool_start", toolUseId, toolName })

    const inputStr = JSON.stringify(TOOL_INPUT, null, 2)
    let charIndex = 0
    let currentInput = ""

    intervalRef.current = setInterval(() => {
      const chunk = inputStr.slice(charIndex, charIndex + 10)
      charIndex += 10
      currentInput += chunk

      handleStreamEvent({
        type: "tool_input_delta",
        toolUseId,
        delta: chunk,
        argsText: currentInput,
      })

      if (charIndex >= inputStr.length) {
        clearIntervalRef()
        timeoutRef.current = setTimeout(() => {
          handleStreamEvent({
            type: "tool_result",
            toolUseId,
            toolName,
            isError: false,
            summary: TOOL_RESULT_SUMMARY,
          })
        }, 500)
      }
    }, 80)
  }, [clearIntervalRef, ensureStreamingMessage, handleStreamEvent, stopTimers])

  const addUserTurn = useCallback(() => {
    stopTimers()
    setMessages(msgs => [
      ...msgs,
      {
        id: getUuid(),
        role: "user",
        content: [{ type: "text", text: "This is a test user message" }],
      },
    ])
  }, [stopTimers])

  const finishMessage = useCallback(() => {
    if (!streamingMessageRef.current) return
    handleStreamEvent({ type: "done" })
  }, [handleStreamEvent])

  const clear = useCallback(() => {
    stopTimers()
    setMessages([])
    setStreamingMessage(null)
    setIsStreaming(false)
    setIsCompacting(false)
  }, [stopTimers])

  const cancel = useCallback(() => {
    stopTimers()
    setStreamingMessage(null)
    setIsStreaming(false)
    setIsCompacting(false)
  }, [stopTimers])

  return {
    messages,
    streamingMessage,
    isStreaming,
    isCompacting,
    addUserTurn,
    streamThinking: () => startWordStream(randomItem(THINKING_SAMPLES), "thinking"),
    streamResponse: () => startWordStream(randomItem(RESPONSE_SAMPLES), "text"),
    streamToolCall,
    finishMessage,
    clear,
    cancel,
  }
}
