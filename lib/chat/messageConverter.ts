/**
 * Message Converter for assistant-ui
 *
 * Converts our database Message type to assistant-ui's ThreadMessageLike format.
 * This bridges our ContentBlock[] schema with their expected message parts.
 */

import type { ThreadMessageLike } from "@assistant-ui/react"
import type { ReadonlyJSONObject } from "assistant-stream/utils"
import type {
  ContentBlock,
  TextContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ThinkingContentBlock,
} from "@/db/schema"
import type { ChatMessage } from "@/lib/agent/utils/chatRepository"

// Re-export for convenience
export type { ChatMessage }

// Type guards for content blocks
const isTextBlock = (b: ContentBlock): b is TextContentBlock => b.type === "text"
const isToolUseBlock = (b: ContentBlock): b is ToolUseContentBlock => b.type === "tool_use"
const isToolResultBlock = (b: ContentBlock): b is ToolResultContentBlock => b.type === "tool_result"
const isThinkingBlock = (b: ContentBlock): b is ThinkingContentBlock => b.type === "thinking"

/**
 * Convert our Message to assistant-ui's ThreadMessageLike format.
 *
 * ThreadMessageLike supports:
 * - role: "assistant" | "user" | "system"
 * - content: string | readonly MessagePart[]
 * - id, createdAt, status, attachments, metadata
 */
export function convertMessage(message: ChatMessage): ThreadMessageLike {
  const role = message.role as "user" | "assistant" | "system"

  // Build a map of tool_use_id → tool_result for pairing
  const toolResults = new Map<string, ToolResultContentBlock>()
  for (const block of message.contentBlocks) {
    if (isToolResultBlock(block)) {
      toolResults.set(block.tool_use_id, block)
    }
  }

  // Convert our ContentBlock[] to assistant-ui's content format
  // Skip tool_result blocks since they're attached to tool-call parts
  const content = message.contentBlocks
    .filter(block => !isToolResultBlock(block))
    .map(block => {
      if (isTextBlock(block)) {
        return {
          type: "text" as const,
          text: block.text,
        }
      }

      if (isToolUseBlock(block)) {
        const result = toolResults.get(block.id)
        return {
          type: "tool-call" as const,
          toolCallId: block.id,
          toolName: block.name,
          args: block.input as ReadonlyJSONObject,
          argsText: JSON.stringify(block.input, null, 2),
          // Attach result if available
          ...(result && { result: result.content }),
        }
      }

      if (isThinkingBlock(block)) {
        // assistant-ui uses "reasoning" for thinking/reasoning content
        return {
          type: "reasoning" as const,
          text: block.thinking,
        }
      }

      // Fallback for unknown block types - convert to text
      return {
        type: "text" as const,
        text: JSON.stringify(block),
      }
    })

  return {
    id: message.id,
    role,
    content,
    createdAt: message.createdAt,
    // Status only applies to assistant messages
    status:
      role === "assistant"
        ? { type: "complete" as const, reason: "stop" as const }
        : undefined,
  }
}

/**
 * Convert a streaming message (in-progress) to ThreadMessageLike.
 * Used for displaying the currently streaming response.
 *
 * Streaming parts maintain order as they arrive (thinking, text, tools interleaved).
 */
type StreamingPart =
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "tool"; toolUseId: string; toolName: string; argsText: string; result?: string; elapsedSeconds?: number; isComplete: boolean }

export interface StreamingMessageState {
  id: string
  parts: StreamingPart[]
  isComplete: boolean
  isCompacting: boolean
}

type MessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: ReadonlyJSONObject; argsText: string }

export function convertStreamingMessage(state: StreamingMessageState): ThreadMessageLike {
  // Convert streaming parts to assistant-ui message parts, maintaining order
  const parts: MessagePart[] = state.parts.map(part => {
    switch (part.type) {
      case "thinking":
        return { type: "reasoning" as const, text: part.text }
      case "text":
        return { type: "text" as const, text: part.text }
      case "tool":
        return {
          type: "tool-call" as const,
          toolCallId: part.toolUseId,
          toolName: part.toolName,
          args: {} as ReadonlyJSONObject,
          argsText: part.argsText,
          ...(part.result !== undefined && { result: part.result }),
        }
    }
  })

  return {
    id: state.id,
    role: "assistant",
    content: parts,
    status: state.isComplete
      ? { type: "complete" as const, reason: "stop" as const }
      : { type: "running" as const },
  }
}
