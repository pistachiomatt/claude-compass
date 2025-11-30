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

import { ChatRuntimeProvider } from "./ChatRuntimeProvider"
import { Thread } from "@/components/assistant-ui/thread"
import { cn } from "@/lib/utils"

interface ChatContainerProps {
  chatId: string
  className?: string
}

export function ChatContainer({ chatId, className }: ChatContainerProps) {
  return (
    <ChatRuntimeProvider chatId={chatId}>
      <div className={cn("flex flex-col h-full", className)}>
        <Thread />
      </div>
    </ChatRuntimeProvider>
  )
}
