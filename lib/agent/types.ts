import { ClaudeModel } from "@/app/types"
import type { ContentBlock } from "@/db/schema"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentTurnResult {
  contentBlocks: ContentBlock[]
  sdkSessionId: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalCostUsd: number
  }
}

export interface AgentTurnOptions {
  maxTurns?: number
  model?: ClaudeModel
}
