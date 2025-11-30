"use client"

import { useAssistantState } from "@assistant-ui/react"
import { AnimatedMarkdown } from "flowtoken"
import "flowtoken/dist/styles.css"
import { memo } from "react"

import { Spinner } from "@/components/ui/spinner"

const MarkdownTextImpl = () => {
  const isStreaming = useAssistantState(({ part }) => part.status?.type === "running")
  const hasText = useAssistantState(({ part }) => part.type === "text" && !!part.text?.trim())
  const text = useAssistantState(({ part }) => (part.type === "text" ? (part.text ?? "") : ""))

  // Show spinner when streaming with no text yet
  if (isStreaming && !hasText) {
    return <Spinner className="size-5 text-muted-foreground" />
  }

  return (
    <div className="aui-md">
      <AnimatedMarkdown
        content={text}
        animation={isStreaming ? "fadeIn" : null}
        animationDuration="1s"
        animationTimingFunction="ease-out"
        sep="word"
      />
    </div>
  )
}

export const MarkdownText = memo(MarkdownTextImpl)
