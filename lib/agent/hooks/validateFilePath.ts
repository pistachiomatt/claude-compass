/**
 * PostToolUse hook to validate that Write/Edit operations use relative paths.
 * Files must be written within the working directory.
 */

import type {
  HookCallback,
  PostToolUseHookInput,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk"
import path from "path"

/**
 * Validates that Write/Edit operations use relative paths only.
 * Returns an error if an absolute path is used.
 */
export const validateFilePathHook: HookCallback = async (input) => {
  if (input.hook_event_name !== "PostToolUse") {
    return {}
  }

  const postInput = input as PostToolUseHookInput
  const { tool_name, tool_input } = postInput

  // Only validate Write and Edit operations
  if (tool_name !== "Write" && tool_name !== "Edit" && tool_name !== "Update") {
    return {}
  }

  const toolInputObj = tool_input as { file_path?: string }
  const filePath = toolInputObj.file_path

  if (!filePath) {
    return {}
  }

  // Check if it's an absolute path
  if (path.isAbsolute(filePath)) {
    console.log(`[validateFilePath] Absolute path rejected: ${filePath}`)

    const output: SyncHookJSONOutput = {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `ERROR: You used an absolute path "${filePath}".

You MUST use relative paths like "./whiteboard.yml" or "./mind.md". All files live in your working directory. Never use absolute paths starting with "/".

Please retry the operation using a relative path.`,
      },
    }
    return output
  }

  // Check for path traversal attempts
  if (filePath.includes("..")) {
    console.log(`[validateFilePath] Path traversal rejected: ${filePath}`)

    const output: SyncHookJSONOutput = {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `ERROR: You used a path with ".." traversal: "${filePath}".

You MUST use relative paths within your working directory. Do not use ".." to escape the directory.

Please retry the operation using a simple relative path.`,
      },
    }
    return output
  }

  return {}
}
