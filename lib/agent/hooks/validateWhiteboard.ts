/**
 * PostToolUse hook to validate whiteboard.yml after Write/Edit operations.
 * Returns an error message to Claude if the YAML is invalid.
 */

import type {
  HookCallback,
  PostToolUseHookInput,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk"
import yaml from "js-yaml"
import fs from "fs"
import path from "path"

interface YAMLExceptionMark {
  line: number
  column: number
  snippet?: string
}

interface YAMLException extends Error {
  name: "YAMLException"
  reason: string
  mark?: YAMLExceptionMark
}

function isYAMLException(err: unknown): err is YAMLException {
  return err instanceof Error && err.name === "YAMLException"
}

/**
 * Validates whiteboard.yml after Write/Edit operations.
 * If invalid, returns additionalContext with error for Claude to fix.
 */
export const validateWhiteboardHook: HookCallback = async (input, _toolUseId, _options) => {
  // Only handle PostToolUse events
  if (input.hook_event_name !== "PostToolUse") {
    return {}
  }

  const postInput = input as PostToolUseHookInput
  const { tool_name, tool_input } = postInput

  // Only validate Write and Edit operations
  if (tool_name !== "Write" && tool_name !== "Edit" && tool_name !== "Update") {
    return {}
  }

  // Check if it's whiteboard.yml
  const toolInputObj = tool_input as { file_path?: string }
  const filePath = toolInputObj.file_path
  if (!filePath || !filePath.endsWith("whiteboard.yml")) {
    return {}
  }

  // Read the file content
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(input.cwd, filePath)

  let content: string
  try {
    content = fs.readFileSync(absolutePath, "utf-8")
  } catch {
    // File doesn't exist or can't be read - let other errors handle this
    return {}
  }

  // Validate YAML - parse directly to get detailed error info
  try {
    yaml.load(content)
    console.log(`[validateWhiteboard] Valid YAML`)
    // Valid YAML
    return {}
  } catch (err) {
    // YAML is invalid - extract detailed error info
    let errorDetails = "Unknown YAML error"

    if (isYAMLException(err)) {
      const { reason, mark } = err
      if (mark) {
        // Line numbers are 0-indexed in js-yaml, add 1 for human-readable
        const line = mark.line + 1
        const col = mark.column + 1
        errorDetails = `${reason} at line ${line}, column ${col}`
        if (mark.snippet) {
          errorDetails += `\n\nContext:\n${mark.snippet}`
        }
      } else {
        errorDetails = reason
      }
    } else if (err instanceof Error) {
      errorDetails = err.message
    }

    console.log(`[validateWhiteboard] YAML error detected: ${errorDetails}`)

    const output: SyncHookJSONOutput = {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `ERROR: The whiteboard.yml you just wrote has invalid YAML syntax.

${errorDetails}

Please fix the YAML syntax immediately by reading the file and correcting the error at the indicated location.`,
      },
    }
    return output
  }
}
