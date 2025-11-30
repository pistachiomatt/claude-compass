/**
 * Agent Session Service
 *
 * Orchestrates Claude Agent SDK interactions.
 * Uses chatRepository for all DB operations.
 *
 * Key responsibility: SDK session management and hydration
 */

import { chatRepository } from "./utils/chatRepository"
import {
  transcriptFileExists,
  restoreTranscriptFile,
  readTranscriptFile,
} from "./utils/sdkTranscript"
import { hydrateToTempDir, syncFromTempDir, diffFiles } from "./utils/virtualFilesystem"
import { setupVertexAuth } from "./utils/setupVertexAuth"
import { MessageRole, type ContentBlock } from "@/db/schema"
import { AgentTurnOptions, AgentTurnResult } from "./types"
import type { StreamEvent } from "./streamTypes"
import { env } from "../env.server"
import { toNativeModel } from "../api/anthropicApi"
import { TARGET_MODEL } from "@/app/types"
import getUuid from "../utils/getUuid"

// Lazy-load SDK after ensuring auth is set up
// This avoids ESM import hoisting issues where SDK initializes before env vars are set
let _query: typeof import("@anthropic-ai/claude-agent-sdk").query | null = null

async function getQuery() {
  if (!_query) {
    // Ensure auth is set up BEFORE importing SDK
    setupVertexAuth()
    const sdk = await import("@anthropic-ai/claude-agent-sdk")
    _query = sdk.query
  }
  return _query
}

export const agentSession = {
  /**
   * Run a single agent turn with full context hydration.
   *
   * Flow:
   * 1. Load chat and check for existing session/transcript
   * 2. Restore transcript file if needed (for resume after restart)
   * 3. Hydrate virtual filesystem to temp directory
   * 4. Run SDK query with Read/Write/Edit tools enabled
   * 5. Persist all new messages (user + assistant)
   * 6. Sync virtual filesystem changes back to DB
   * 7. Save transcript to DB for future restoration
   */
  async runTurn(
    chatId: string,
    userMessage: string,
    options: AgentTurnOptions = {},
  ): Promise<AgentTurnResult> {
    const { maxTurns = env.MAX_TURN_COUNT, model: _model = TARGET_MODEL } = options
    const model = toNativeModel(_model)

    // 1. Load chat with existing messages
    const chatData = await chatRepository.getChatWithMessages(chatId)
    if (!chatData) {
      throw new Error(`Chat not found: ${chatId}`)
    }

    // 2. Hydrate virtual filesystem to temp directory (need tempPath for transcript lookup)
    const { tempPath, written, skipped } = hydrateToTempDir(chatId, chatData.files)
    if (written > 0 || skipped > 0) {
      console.log(`Hydrated files: ${written} written, ${skipped} skipped`)
    }

    // 3. Check if we need to restore transcript file before resuming
    const canResume = !!chatData.sdkSessionId
    let shouldResume = canResume

    if (canResume && chatData.sdkSessionId) {
      // Use tempPath for transcript lookup since that's the cwd we pass to SDK
      if (!transcriptFileExists(chatData.sdkSessionId, tempPath)) {
        const transcriptData = await chatRepository.getTranscript(chatId)
        if (transcriptData?.sdkTranscript) {
          console.log(`Transcript file missing, restoring from DB...`)
          restoreTranscriptFile(chatData.sdkSessionId, transcriptData.sdkTranscript, tempPath)
        } else {
          // No transcript in DB either - can't resume, fall back to fresh
          console.log(`No transcript in DB, starting fresh session`)
          shouldResume = false
        }
      }
    }

    // 4. Persist user message
    await chatRepository.createMessage({
      chatId,
      role: MessageRole.USER,
      contentBlocks: [{ type: "text", text: userMessage }],
    })

    // 5. Run SDK query
    let sdkSessionId = ""
    const contentBlocks: ContentBlock[] = [] // Accumulate ALL blocks across all assistant messages
    let usage: AgentTurnResult["usage"]

    const query = await getQuery()
    const response = query({
      prompt: userMessage,
      options: {
        model,
        maxTurns,
        cwd: tempPath,
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
        permissionMode: "bypassPermissions",
        ...(shouldResume && chatData.sdkSessionId ? { resume: chatData.sdkSessionId } : {}),
      },
    })

    console.log(
      shouldResume && chatData.sdkSessionId
        ? `Resuming SDK session: ${chatData.sdkSessionId}`
        : `Starting fresh SDK session`,
    )

    // Collect all messages from the SDK
    for await (const message of response) {
      if (message.type === "system" && message.subtype === "init") {
        sdkSessionId = message.session_id
      }

      // Accumulate content blocks from ALL assistant messages
      // In multi-turn scenarios: Turn 1 may have [thinking, tool_use], Turn 2 may have [text]
      if (message.type === "assistant") {
        const blocks = message.message.content as ContentBlock[]
        contentBlocks.push(...blocks)
      }

      // Capture tool_result from user messages (SDK sends these automatically)
      if (message.type === "user") {
        const blocks = message.message.content as ContentBlock[]
        // Only add tool_result blocks, not the original user text
        for (const block of blocks) {
          if (block.type === "tool_result") {
            contentBlocks.push(block)
          }
        }
      }

      if (message.type === "result" && message.subtype === "success") {
        usage = {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          totalCostUsd: message.total_cost_usd,
        }
      }
    }

    // 6. Persist assistant message with ALL accumulated content blocks
    await chatRepository.createMessage({
      chatId,
      role: MessageRole.ASSISTANT,
      contentBlocks,
    })

    // 7. Sync virtual filesystem changes back to DB
    const newFiles = syncFromTempDir(chatId)
    const fileChanges = diffFiles(chatData.files, newFiles)
    if (fileChanges.added.length || fileChanges.modified.length || fileChanges.deleted.length) {
      await chatRepository.updateFiles(chatId, newFiles)
      console.log(
        `Synced files: +${fileChanges.added.length} ~${fileChanges.modified.length} -${fileChanges.deleted.length}`,
      )
    }

    // 8. Read transcript file and save to DB for future restoration
    const transcriptContent = readTranscriptFile(sdkSessionId, tempPath)
    if (transcriptContent) {
      await chatRepository.updateSdkSession(chatId, sdkSessionId, transcriptContent)
      console.log(`Saved transcript to DB (${transcriptContent.length} bytes)`)
    } else {
      // Fallback: just save session ID
      await chatRepository.updateSdkSessionId(chatId, sdkSessionId)
    }

    return {
      contentBlocks,
      sdkSessionId,
      usage,
    }
  },

  /**
   * Run a single agent turn with streaming events.
   *
   * Same flow as runTurn but yields StreamEvents for real-time UI updates.
   * NOTE: User message must be created by caller BEFORE calling this
   * to prevent duplicate messages on subscription retries.
   */
  async *runTurnStream(
    chatId: string,
    userMessage: string,
    options: AgentTurnOptions = {},
  ): AsyncGenerator<StreamEvent> {
    const {
      maxTurns = env.MAX_TURN_COUNT,
      model: _model = TARGET_MODEL,
      maxThinkingTokens,
    } = options
    const model = toNativeModel(_model)

    // 1. Load chat with existing messages
    const chatData = await chatRepository.getChatWithMessages(chatId)
    if (!chatData) {
      yield { type: "error", error: `Chat not found: ${chatId}` }
      return
    }

    // 2. Hydrate virtual filesystem to temp directory (need tempPath for transcript lookup)
    const { tempPath } = hydrateToTempDir(chatId, chatData.files)

    // 3. Check if we need to restore transcript file before resuming
    const canResume = !!chatData.sdkSessionId
    let shouldResume = canResume

    if (canResume && chatData.sdkSessionId) {
      // Use tempPath for transcript lookup since that's the cwd we pass to SDK
      if (!transcriptFileExists(chatData.sdkSessionId, tempPath)) {
        const transcriptData = await chatRepository.getTranscript(chatId)
        if (transcriptData?.sdkTranscript) {
          restoreTranscriptFile(chatData.sdkSessionId, transcriptData.sdkTranscript, tempPath)
        } else {
          shouldResume = false
        }
      }
    }

    // 4. Run SDK query (user message already saved by caller)
    const messageId = getUuid()
    let sdkSessionId = ""
    const allContentBlocks: ContentBlock[] = [] // Accumulate ALL blocks across all assistant messages
    let usage: AgentTurnResult["usage"]
    let accumulatedText = ""
    let accumulatedThinking = ""
    const toolIndexToId = new Map<number, string>() // Map content block index → tool_use_id
    const accumulatedToolInputs = new Map<string, string>() // Track input per tool_use_id

    const query = await getQuery()
    const response = query({
      prompt: userMessage,
      options: {
        model,
        maxTurns,
        cwd: tempPath,
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
        permissionMode: "bypassPermissions",
        includePartialMessages: true,
        ...(maxThinkingTokens ? { maxThinkingTokens } : {}),
        ...(shouldResume && chatData.sdkSessionId ? { resume: chatData.sdkSessionId } : {}),
      },
    })

    // Yield init immediately
    yield { type: "init", messageId, sdkSessionId: "" }

    // Process SDK events
    for await (const message of response) {
      // Handle streaming events (text, thinking, tools)
      if (message.type === "stream_event" && "event" in message) {
        const event = message.event as {
          type: string
          index?: number
          content_block?: { type: string; id?: string; name?: string }
          delta?: { type: string; text?: string; thinking?: string; partial_json?: string }
        }

        // Text delta
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta" &&
          event.delta.text
        ) {
          accumulatedText += event.delta.text
          yield { type: "text_delta", delta: event.delta.text, text: accumulatedText }
        }

        // Thinking delta (extended thinking)
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "thinking_delta" &&
          event.delta.thinking
        ) {
          accumulatedThinking += event.delta.thinking
          yield {
            type: "thinking_delta",
            delta: event.delta.thinking,
            thinking: accumulatedThinking,
          }
        }

        // Tool use start (from content_block_start)
        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          const toolUseId = event.content_block.id || ""
          // Track index → tool_use_id for input_json_delta events
          if (event.index !== undefined) {
            toolIndexToId.set(event.index, toolUseId)
          }
          yield {
            type: "tool_start",
            toolUseId,
            toolName: event.content_block.name || "unknown",
          }
        }

        // Tool input JSON delta
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "input_json_delta" &&
          event.delta.partial_json &&
          event.index !== undefined
        ) {
          const toolUseId = toolIndexToId.get(event.index)
          if (toolUseId) {
            const current = accumulatedToolInputs.get(toolUseId) || ""
            const updated = current + event.delta.partial_json
            accumulatedToolInputs.set(toolUseId, updated)
            yield {
              type: "tool_input_delta",
              toolUseId,
              delta: event.delta.partial_json,
              argsText: updated,
            }
          }
        }
      }

      // Session init
      if (message.type === "system" && message.subtype === "init") {
        sdkSessionId = message.session_id
      }

      // Compaction status - SDK sends status: 'compacting' when starting
      if (message.type === "system" && message.subtype === "status") {
        const statusMsg = message as { status: "compacting" | null }
        if (statusMsg.status === "compacting") {
          yield { type: "compact_start", trigger: "auto" }
        }
      }

      // Compaction boundary - marks completion with metadata
      if (message.type === "system" && message.subtype === "compact_boundary") {
        const boundaryMsg = message as {
          compact_metadata: { trigger: "manual" | "auto"; pre_tokens: number }
        }
        yield {
          type: "compact_complete",
          preTokens: boundaryMsg.compact_metadata.pre_tokens,
        }
      }

      // Tool progress
      if (message.type === "tool_progress") {
        yield {
          type: "tool_progress",
          toolUseId: message.tool_use_id,
          toolName: message.tool_name,
          elapsedSeconds: message.elapsed_time_seconds,
        }
      }

      // Assistant message - ACCUMULATE contentBlocks from all assistant turns
      // In multi-turn scenarios: Turn 1 may have [thinking, tool_use], Turn 2 may have [text]
      // We want to collect ALL of them
      if (message.type === "assistant") {
        const blocks = message.message.content as ContentBlock[]
        allContentBlocks.push(...blocks)
      }

      // Capture tool_result from user messages (SDK sends these automatically)
      if (message.type === "user") {
        const blocks = message.message.content as ContentBlock[]
        // Only add tool_result blocks, not the original user text
        for (const block of blocks) {
          if (block.type === "tool_result") {
            allContentBlocks.push(block)
            // Type assertion needed due to ContentBlock union including catch-all type
            const toolResultBlock = block as {
              tool_use_id: string
              content: unknown
              is_error?: boolean
            }
            yield {
              type: "tool_result",
              toolUseId: toolResultBlock.tool_use_id,
              toolName: "", // Not available from tool_result block
              isError: toolResultBlock.is_error === true,
              summary:
                typeof toolResultBlock.content === "string" ? toolResultBlock.content : undefined,
            }
          }
        }
      }

      // Result
      if (message.type === "result" && message.subtype === "success") {
        usage = {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          totalCostUsd: message.total_cost_usd,
        }
      }
    }

    // 5. Persist assistant message with ALL accumulated content blocks
    await chatRepository.createMessage({
      chatId,
      role: MessageRole.ASSISTANT,
      contentBlocks: allContentBlocks,
    })

    // 6. Sync virtual filesystem
    const newFiles = syncFromTempDir(chatId)
    const fileChanges = diffFiles(chatData.files, newFiles)
    if (fileChanges.added.length || fileChanges.modified.length || fileChanges.deleted.length) {
      await chatRepository.updateFiles(chatId, newFiles)
    }

    // 7. Save transcript
    const transcriptContent = readTranscriptFile(sdkSessionId, tempPath)
    if (transcriptContent) {
      await chatRepository.updateSdkSession(chatId, sdkSessionId, transcriptContent)
    } else if (sdkSessionId) {
      await chatRepository.updateSdkSessionId(chatId, sdkSessionId)
    }

    // Yield final message with ALL accumulated content blocks
    yield { type: "message_complete", messageId, contentBlocks: allContentBlocks, usage }
    yield { type: "done" }
  },

  /**
   * Get messages for display (delegates to repository)
   */
  async getMessages(chatId: string) {
    return chatRepository.getMessages(chatId)
  },
}
