/**
 * Virtual Filesystem Utilities
 *
 * Handles hydrating virtual files to temp directory before SDK calls,
 * and syncing changes back to DB after each turn.
 *
 * The SDK's built-in Read/Write/Edit tools operate on the real filesystem,
 * so we maintain a temp directory per chat that mirrors the DB state.
 */

import { mkdirSync, writeFileSync, readdirSync, readFileSync, statSync, existsSync } from "fs"
import { join, dirname, relative } from "path"
import { tmpdir } from "os"
import type { VirtualFiles } from "@/db/schema"

const TEMP_BASE = join(tmpdir(), "compass")

/**
 * Get the temp directory path for a chat's virtual filesystem
 */
export function getTempPath(chatId: string): string {
  return join(TEMP_BASE, chatId)
}

/**
 * Hydrate virtual files from DB to temp directory
 * Only writes files that are missing or have changed content
 * Returns the temp path and count of files written
 */
export function hydrateToTempDir(
  chatId: string,
  files: VirtualFiles,
): { tempPath: string; written: number; skipped: number } {
  const tempPath = getTempPath(chatId)

  // Ensure base directory exists
  mkdirSync(tempPath, { recursive: true })

  let written = 0
  let skipped = 0

  // Write each file (only if missing or changed)
  for (const [relativePath, file] of Object.entries(files)) {
    const fullPath = join(tempPath, relativePath)
    const dir = dirname(fullPath)

    // Check if file exists and matches
    if (existsSync(fullPath)) {
      const existingContent = readFileSync(fullPath, "utf-8")
      if (existingContent === file.content) {
        skipped++
        continue
      }
    }

    // Create parent directories if needed
    mkdirSync(dir, { recursive: true })

    // Write file content
    writeFileSync(fullPath, file.content, "utf-8")
    written++
  }

  return { tempPath, written, skipped }
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string, baseDir: string = dir): string[] {
  if (!existsSync(dir)) return []

  const files: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      files.push(relative(baseDir, fullPath))
    }
  }

  return files
}

/**
 * Sync files from temp directory back to VirtualFiles format
 * Returns the new files state to be saved to DB
 */
export function syncFromTempDir(chatId: string): VirtualFiles {
  const tempPath = getTempPath(chatId)
  const files: VirtualFiles = {}

  if (!existsSync(tempPath)) {
    return files
  }

  const allFiles = getAllFiles(tempPath)

  for (const relativePath of allFiles) {
    const fullPath = join(tempPath, relativePath)
    const content = readFileSync(fullPath, "utf-8")
    const stat = statSync(fullPath)

    files[relativePath] = {
      content,
      updatedAt: stat.mtime.toISOString(),
    }
  }

  return files
}

/**
 * Check if a chat's temp directory exists
 */
export function tempDirExists(chatId: string): boolean {
  return existsSync(getTempPath(chatId))
}

/**
 * Compute diff between old and new files
 * Returns list of changes for logging/debugging
 */
export function diffFiles(
  oldFiles: VirtualFiles,
  newFiles: VirtualFiles,
): { added: string[]; modified: string[]; deleted: string[] } {
  const added: string[] = []
  const modified: string[] = []
  const deleted: string[] = []

  // Check for added/modified
  for (const path of Object.keys(newFiles)) {
    if (!(path in oldFiles)) {
      added.push(path)
    } else if (oldFiles[path].content !== newFiles[path].content) {
      modified.push(path)
    }
  }

  // Check for deleted
  for (const path of Object.keys(oldFiles)) {
    if (!(path in newFiles)) {
      deleted.push(path)
    }
  }

  return { added, modified, deleted }
}
