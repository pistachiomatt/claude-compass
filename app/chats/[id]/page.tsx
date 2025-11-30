"use client"

import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { ChatContainer } from "@/components/chat/ChatContainer"

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()

  const { data: chat, isLoading } = trpc.chat.getById.useQuery(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chat not found</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-medium">{chat.name}</h1>
          <p className="text-xs text-muted-foreground">
            Session: {chat.sdkSessionId || "none"}
          </p>
        </div>
      </header>

      {/* Chat */}
      <ChatContainer chatId={id} className="flex-1 min-h-0" />
    </div>
  )
}
