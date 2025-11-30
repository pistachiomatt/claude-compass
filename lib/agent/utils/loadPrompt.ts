/**
 * Prompt Loader
 *
 * Loads prompt files from the prompts/ directory.
 * Cached after first load for performance.
 */

import { readFileSync } from "fs"
import { join } from "path"

const PROMPTS_DIR = join(process.cwd(), "prompts")
const promptCache = new Map<string, string>()

/**
 * Load a prompt file from prompts/ directory.
 * Results are cached after first read.
 *
 * @param filename - The prompt filename (e.g., "systemPrompt.md")
 * @returns The prompt content, or empty string if not found
 */
export function loadPrompt(filename: string): string {
  const cached = promptCache.get(filename)
  if (cached !== undefined) {
    return cached
  }

  const filePath = join(PROMPTS_DIR, filename)
  try {
    const content = readFileSync(filePath, "utf-8")
    promptCache.set(filename, content)
    return content
  } catch (e) {
    console.error(`Failed to load prompt "${filename}" from ${filePath}:`, e)
    promptCache.set(filename, "")
    return ""
  }
}

/**
 * Clear all cached prompts.
 * Useful for testing or hot-reloading.
 */
export function clearPromptCache(): void {
  promptCache.clear()
}
