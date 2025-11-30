/**
 * Stream Event Types
 *
 * Defines the events yielded during streaming chat responses.
 * These are simpler than raw SDK events, optimized for frontend consumption.
 */

import type { ContentBlock } from "@/db/schema"

// Individual stream event types
export interface StreamEventInit {
  type: "init"
  messageId: string
  sdkSessionId: string
}

export interface StreamEventTextDelta {
  type: "text_delta"
  delta: string
  // Accumulated text so far (for convenience)
  text: string
}

export interface StreamEventThinkingDelta {
  type: "thinking_delta"
  delta: string
  thinking: string
}

export interface StreamEventToolStart {
  type: "tool_start"
  toolUseId: string
  toolName: string
}

export interface StreamEventToolProgress {
  type: "tool_progress"
  toolUseId: string
  toolName: string
  elapsedSeconds: number
}

export interface StreamEventToolResult {
  type: "tool_result"
  toolUseId: string
  toolName: string
  // Simplified result for UI display
  isError: boolean
  summary?: string
}

export interface StreamEventMessageComplete {
  type: "message_complete"
  messageId: string
  contentBlocks: ContentBlock[]
  usage?: {
    inputTokens: number
    outputTokens: number
    totalCostUsd: number
  }
}

export interface StreamEventDone {
  type: "done"
}

export interface StreamEventError {
  type: "error"
  error: string
}

// Union of all stream events
export type StreamEvent =
  | StreamEventInit
  | StreamEventTextDelta
  | StreamEventThinkingDelta
  | StreamEventToolStart
  | StreamEventToolProgress
  | StreamEventToolResult
  | StreamEventMessageComplete
  | StreamEventDone
  | StreamEventError
