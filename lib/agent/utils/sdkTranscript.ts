/**
 * SDK Transcript File Management
 *
 * Handles reading/writing SDK transcript files for session hydration.
 *
 * ⚠️ KNOWN LIMITATION:
 * The SDK stores transcripts at ~/.claude/projects/{sanitized-cwd}/{sessionId}.jsonl
 * There is no public API to get this path - we replicate the SDK's internal logic.
 * If the SDK changes this path format, this will break.
 *
 * Possible future improvements:
 * - Use SDK hooks (SessionStart) which receive transcript_path
 * - Request a public API from SDK team to get transcript location
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"

/**
 * Get the SDK transcript directory path.
 * SDK stores transcripts in ~/.claude/projects/{sanitized-cwd}/
 *
 * This replicates the SDK's internal path construction.
 * See: BaseHookInput.transcript_path in sdk.d.ts
 */
export function getTranscriptDir(cwd: string = process.cwd()): string {
  // SDK replaces slashes with dashes in the path
  const sanitizedPath = cwd.replace(/\//g, "-")
  return join(process.env.HOME || "", ".claude", "projects", sanitizedPath)
}

/**
 * Get the full path to a session's transcript file.
 */
export function getTranscriptPath(sessionId: string, cwd?: string): string {
  return join(getTranscriptDir(cwd), `${sessionId}.jsonl`)
}

/**
 * Check if a transcript file exists on disk.
 */
export function transcriptFileExists(sessionId: string, cwd?: string): boolean {
  return existsSync(getTranscriptPath(sessionId, cwd))
}

/**
 * Restore a transcript file from DB content.
 * Call this BEFORE resuming an SDK session after process restart.
 */
export function restoreTranscriptFile(sessionId: string, content: string, cwd?: string): void {
  const transcriptDir = getTranscriptDir(cwd)
  const transcriptPath = getTranscriptPath(sessionId, cwd)

  // Ensure directory exists
  if (!existsSync(transcriptDir)) {
    mkdirSync(transcriptDir, { recursive: true })
  }

  writeFileSync(transcriptPath, content, "utf-8")
  console.log(`Restored transcript file: ${transcriptPath} (${content.length} bytes)`)
}

/**
 * Read a transcript file after SDK operations.
 * Call this AFTER SDK query completes to persist the updated transcript.
 */
export function readTranscriptFile(sessionId: string, cwd?: string): string | null {
  const transcriptPath = getTranscriptPath(sessionId, cwd)

  if (!existsSync(transcriptPath)) {
    console.warn(`Transcript file not found: ${transcriptPath}`)
    return null
  }

  return readFileSync(transcriptPath, "utf-8")
}
