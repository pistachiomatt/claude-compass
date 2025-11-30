"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { useChatStream } from "@/hooks/useChatStream"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ContentBlock,
  TextContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ThinkingContentBlock,
} from "@/db/schema"

// Type guards for content blocks
const isTextBlock = (b: ContentBlock): b is TextContentBlock => b.type === "text"
const isToolUseBlock = (b: ContentBlock): b is ToolUseContentBlock => b.type === "tool_use"
const isToolResultBlock = (b: ContentBlock): b is ToolResultContentBlock => b.type === "tool_result"
const isThinkingBlock = (b: ContentBlock): b is ThinkingContentBlock => b.type === "thinking"

/**
 * Render content blocks from Anthropic API response
 */
function renderContentBlocks(blocks: ContentBlock[]) {
  return blocks.map((block, i) => {
    if (isTextBlock(block)) {
      return (
        <div key={i} className="whitespace-pre-wrap">
          {block.text}
        </div>
      )
    }
    if (isToolUseBlock(block)) {
      return (
        <div key={i} className="mt-2 p-2 bg-background/50 rounded text-xs font-mono">
          <span className="text-muted-foreground">Tool: </span>
          {block.name}
        </div>
      )
    }
    if (isToolResultBlock(block)) {
      return (
        <div key={i} className="mt-2 p-2 bg-background/50 rounded text-xs">
          <span className="text-muted-foreground">Result: </span>
          {typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content)}
        </div>
      )
    }
    if (isThinkingBlock(block)) {
      return (
        <div key={i} className="mt-2 p-2 bg-yellow-500/10 rounded text-xs italic">
          <span className="text-muted-foreground">Thinking: </span>
          {block.thinking}
        </div>
      )
    }
    return null
  })
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const [input, setInput] = useState("")

  const { data: chat, isLoading: chatLoading } = trpc.chat.getById.useQuery(id)
  const { data: messages = [] } = trpc.chat.getMessages.useQuery(id)
  const { sendMessage, isStreaming, streamingMessage, error } = useChatStream(id)

  if (chatLoading) {
    return <div className="p-4">Loading...</div>
  }

  if (!chat) {
    return <div className="p-4">Chat not found</div>
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    sendMessage(input)
    setInput("")
  }

  return (
    <div className="flex flex-col h-screen p-4">
      {/* Header */}
      <div className="mb-4 pb-2 border-b">
        <h1 className="text-lg font-medium">Chat: {chat.name}</h1>
        <p className="text-sm text-muted-foreground">
          SDK session: {chat.sdkSessionId || "none"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.length === 0 && !streamingMessage ? (
          <p className="text-muted-foreground">No messages yet. Send one below.</p>
        ) : (
          <>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"
                }`}
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {msg.role.toUpperCase()}
                </div>
                {renderContentBlocks(msg.contentBlocks)}
              </div>
            ))}

            {/* Streaming message */}
            {streamingMessage && (
              <div className="p-3 rounded-lg bg-muted mr-8">
                <div className="text-xs text-muted-foreground mb-1">ASSISTANT</div>
                {/* Streaming thinking */}
                {streamingMessage.thinking && (
                  <details className="mb-2" open>
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      💭 Thinking...
                    </summary>
                    <div className="mt-1 p-2 bg-yellow-500/10 rounded text-xs italic max-h-48 overflow-auto">
                      {streamingMessage.thinking}
                    </div>
                  </details>
                )}
                {/* Active tools */}
                {streamingMessage.activeTools.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {streamingMessage.activeTools.map(tool => (
                      <div
                        key={tool.toolUseId}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span className="animate-spin">⚙️</span>
                        <span>
                          {tool.toolName}
                          {tool.elapsedSeconds !== undefined && (
                            <span className="ml-1">({tool.elapsedSeconds.toFixed(1)}s)</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Streaming text */}
                <div className="whitespace-pre-wrap">
                  {streamingMessage.text || (
                    <span className="animate-pulse text-muted-foreground">
                      {streamingMessage.thinking ? "Processing..." : "Thinking..."}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isStreaming}
          className="flex-1"
        />
        <Button type="submit" disabled={isStreaming || !input.trim()}>
          Send
        </Button>
      </form>

      {error && (
        <p className="text-destructive text-sm mt-2">
          Error: {error}
        </p>
      )}
    </div>
  )
}
