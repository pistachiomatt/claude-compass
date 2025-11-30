/**
 * Agent Session Service
 *
 * Orchestrates Claude Agent SDK interactions.
 * Uses chatRepository for all DB operations.
 *
 * Key responsibility: SDK session management and hydration
 */

import { setupVertexAuth } from "./utils/setupVertexAuth"

// Initialize Vertex auth before any SDK calls
setupVertexAuth()

import { query } from "@anthropic-ai/claude-agent-sdk"
import { chatRepository } from "./utils/chatRepository"
import {
  transcriptFileExists,
  restoreTranscriptFile,
  readTranscriptFile,
} from "./utils/sdkTranscript"
import {
  hydrateToTempDir,
  syncFromTempDir,
  diffFiles,
} from "./utils/virtualFilesystem"
import { MessageRole, type ContentBlock } from "@/db/schema"
import { AgentTurnOptions, AgentTurnResult } from "./types"
import { env } from "../env.server"
import { toNativeModel } from "../api/anthropicApi"
import { TARGET_MODEL } from "@/app/types"

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

    // 2. Check if we need to restore transcript file before resuming
    const canResume = !!chatData.sdkSessionId
    let shouldResume = canResume

    if (canResume && chatData.sdkSessionId) {
      if (!transcriptFileExists(chatData.sdkSessionId)) {
        const transcriptData = await chatRepository.getTranscript(chatId)
        if (transcriptData?.sdkTranscript) {
          console.log(`Transcript file missing, restoring from DB...`)
          restoreTranscriptFile(chatData.sdkSessionId, transcriptData.sdkTranscript)
        } else {
          // No transcript in DB either - can't resume, fall back to fresh
          console.log(`No transcript in DB, starting fresh session`)
          shouldResume = false
        }
      }
    }

    // 3. Hydrate virtual filesystem to temp directory
    const { tempPath, written, skipped } = hydrateToTempDir(chatId, chatData.files)
    if (written > 0 || skipped > 0) {
      console.log(`Hydrated files: ${written} written, ${skipped} skipped`)
    }

    // 4. Persist user message
    await chatRepository.createMessage({
      chatId,
      role: MessageRole.USER,
      contentBlocks: [{ type: "text", text: userMessage }],
    })

    // 5. Run SDK query
    let sdkSessionId = ""
    let contentBlocks: ContentBlock[] = []
    let usage: AgentTurnResult["usage"]

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

      if (message.type === "assistant") {
        // Store raw content blocks as-is
        contentBlocks = message.message.content as ContentBlock[]
      }

      if (message.type === "result" && message.subtype === "success") {
        usage = {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          totalCostUsd: message.total_cost_usd,
        }
      }
    }

    // 6. Persist assistant message with raw content blocks
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
    const transcriptContent = readTranscriptFile(sdkSessionId)
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
   * Get messages for display (delegates to repository)
   */
  async getMessages(chatId: string) {
    return chatRepository.getMessages(chatId)
  },
}
