"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"

import {
  useAssistantState,
  type ReasoningMessagePartComponent,
  type ReasoningGroupComponent,
} from "@assistant-ui/react"

import brainAnimation from "@/public/brain-animation.json"
import { ActionCard } from "@/components/ui/action-card"

/**
 * Single reasoning text part with markdown support.
 */
const ReasoningImpl: ReasoningMessagePartComponent = ({ text }) => (
  <div
    className="prose prose-sm dark:prose-invert max-w-none text-sm leading-tight custom-tracking-tight
      [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0
      [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded"
  >
    <ReactMarkdown>{text}</ReactMarkdown>
  </div>
)

/**
 * Collapsible wrapper that groups consecutive reasoning parts.
 * Uses ActionCard for the collapsible UI with credits crawl effect.
 */
const ReasoningGroupImpl: ReasoningGroupComponent = ({
  children,
  startIndex,
  endIndex,
}) => {
  // Check if streaming (returns primitive boolean)
  const isStreaming = useAssistantState(({ message }) => {
    if (message.status?.type !== "running") return false
    const lastIndex = message.parts.length - 1
    if (lastIndex < 0) return false
    const lastType = message.parts[lastIndex]?.type
    if (lastType !== "reasoning") return false
    return lastIndex >= startIndex && lastIndex <= endIndex
  })

  // Check if there's content (returns primitive boolean)
  const hasContent = useAssistantState(({ message }) => {
    for (let i = startIndex; i <= endIndex && i < message.parts.length; i++) {
      const part = message.parts[i]
      if (part?.type === "reasoning" && "text" in part) {
        if (typeof part.text === "string" && part.text.trim().length > 0) {
          return true
        }
      }
    }
    return false
  })

  return (
    <ActionCard
      lottieData={brainAnimation}
      activeHeading="Thinking..."
      inactiveHeading="See my thinking"
      isActive={isStreaming}
      hasContent={hasContent}
      className="aui-reasoning-root"
    >
      {children}
    </ActionCard>
  )
}

export const Reasoning = memo(ReasoningImpl)
Reasoning.displayName = "Reasoning"

export const ReasoningGroup = memo(ReasoningGroupImpl)
ReasoningGroup.displayName = "ReasoningGroup"
