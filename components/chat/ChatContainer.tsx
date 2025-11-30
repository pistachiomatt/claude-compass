"use client"

/**
 * Chat Container
 *
 * A modular, self-contained chat component that can be embedded anywhere.
 * Integrates assistant-ui Thread with our tRPC backend.
 *
 * Usage:
 *   <ChatContainer chatId="abc123" />
 *   <ChatContainer chatId="abc123" className="h-[600px]" />
 */

import { useEffect, useRef } from "react"
import { ChatRuntimeProvider } from "./ChatRuntimeProvider"
import { Thread } from "@/components/assistant-ui/thread"
import { cn } from "@/lib/utils"

interface ChatContainerProps {
  chatId: string
  className?: string
  focusTrigger?: number
}

export function ChatContainer({ chatId, className, focusTrigger }: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusTrigger !== undefined && focusTrigger > 0) {
      // Small delay to ensure the chat is visible before focusing
      const timer = setTimeout(() => {
        const textarea = containerRef.current?.querySelector<HTMLTextAreaElement>(".aui-composer-input")
        textarea?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [focusTrigger])

  return (
    <ChatRuntimeProvider chatId={chatId}>
      <div ref={containerRef} className={cn("flex flex-col h-full", className)}>
        <Thread />
      </div>
    </ChatRuntimeProvider>
  )
}
