/**
 * Content Block Utilities
 *
 * Helper functions for working with Anthropic content blocks.
 * Use these for display/UI purposes, not for storage.
 */

import type {
  ContentBlock,
  TextContentBlock,
  ToolUseContentBlock,
  ThinkingContentBlock,
} from "@/db/schema"

/**
 * Extract all text from content blocks (for display convenience)
 */
export function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((block): block is TextContentBlock => block.type === "text")
    .map(block => block.text)
    .join("\n")
}

/**
 * Check if content blocks contain any tool use
 */
export function hasToolUse(blocks: ContentBlock[]): boolean {
  return blocks.some(block => block.type === "tool_use")
}

/**
 * Check if content blocks contain thinking
 */
export function hasThinking(blocks: ContentBlock[]): boolean {
  return blocks.some(block => block.type === "thinking")
}

/**
 * Get tool use blocks
 */
export function getToolUseBlocks(blocks: ContentBlock[]): ToolUseContentBlock[] {
  return blocks.filter((block): block is ToolUseContentBlock => block.type === "tool_use")
}

/**
 * Get thinking blocks
 */
export function getThinkingBlocks(blocks: ContentBlock[]): ThinkingContentBlock[] {
  return blocks.filter((block): block is ThinkingContentBlock => block.type === "thinking")
}
