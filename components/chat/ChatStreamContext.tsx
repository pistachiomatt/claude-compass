"use client"

import { createContext, useContext, type ReactNode } from "react"

interface ChatStreamState {
  isCompacting: boolean
}

const ChatStreamContext = createContext<ChatStreamState>({
  isCompacting: false,
})

export function ChatStreamProvider({
  isCompacting,
  children,
}: ChatStreamState & { children: ReactNode }) {
  return (
    <ChatStreamContext.Provider value={{ isCompacting }}>
      {children}
    </ChatStreamContext.Provider>
  )
}

export function useChatStreamState() {
  return useContext(ChatStreamContext)
}
