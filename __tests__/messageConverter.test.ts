import {
  convertMessage,
  convertStreamingMessage,
  type StreamingMessageState,
} from "@/lib/chat/messageConverter"
import type { ChatMessage } from "@/lib/agent/utils/chatRepository"

describe("convertMessage", () => {
  const baseMessage: ChatMessage = {
    id: "msg-123",
    role: "assistant",
    contentBlocks: [],
    createdAt: new Date("2024-01-01"),
  }

  it("converts text blocks", () => {
    const message: ChatMessage = {
      ...baseMessage,
      contentBlocks: [{ type: "text", text: "Hello world" }],
    }

    const result = convertMessage(message)

    expect(result.id).toBe("msg-123")
    expect(result.role).toBe("assistant")
    expect(result.content).toHaveLength(1)
    expect(result.content[0]).toEqual({ type: "text", text: "Hello world" })
  })

  it("converts thinking blocks to reasoning", () => {
    const message: ChatMessage = {
      ...baseMessage,
      contentBlocks: [{ type: "thinking", thinking: "Let me consider..." }],
    }

    const result = convertMessage(message)

    expect(result.content[0]).toEqual({
      type: "reasoning",
      text: "Let me consider...",
    })
  })

  it("converts tool_use blocks with paired results", () => {
    const message: ChatMessage = {
      ...baseMessage,
      contentBlocks: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "Read",
          input: { file_path: "/test.txt" },
        },
        {
          type: "tool_result",
          tool_use_id: "tool-1",
          content: "File contents here",
        },
      ],
    }

    const result = convertMessage(message)

    // Should only have 1 part (tool_result is attached, not separate)
    expect(result.content).toHaveLength(1)
    expect(result.content[0]).toMatchObject({
      type: "tool-call",
      toolCallId: "tool-1",
      toolName: "Read",
      result: "File contents here",
    })
  })

  it("handles tool_use without result", () => {
    const message: ChatMessage = {
      ...baseMessage,
      contentBlocks: [
        {
          type: "tool_use",
          id: "tool-2",
          name: "Write",
          input: { file_path: "/out.txt", content: "data" },
        },
      ],
    }

    const result = convertMessage(message)

    expect(result.content[0]).toMatchObject({
      type: "tool-call",
      toolCallId: "tool-2",
      toolName: "Write",
    })
    expect(result.content[0]).not.toHaveProperty("result")
  })

  it("preserves order of mixed content", () => {
    const message: ChatMessage = {
      ...baseMessage,
      contentBlocks: [
        { type: "thinking", thinking: "Thinking first" },
        { type: "text", text: "Then text" },
        { type: "tool_use", id: "t1", name: "Glob", input: {} },
        { type: "text", text: "More text" },
      ],
    }

    const result = convertMessage(message)

    expect(result.content).toHaveLength(4)
    expect(result.content[0]).toMatchObject({ type: "reasoning" })
    expect(result.content[1]).toMatchObject({ type: "text", text: "Then text" })
    expect(result.content[2]).toMatchObject({ type: "tool-call" })
    expect(result.content[3]).toMatchObject({ type: "text", text: "More text" })
  })

  it("sets status for assistant messages", () => {
    const result = convertMessage({ ...baseMessage, role: "assistant" })
    expect(result.status).toEqual({ type: "complete", reason: "stop" })
  })

  it("does not set status for user messages", () => {
    const result = convertMessage({ ...baseMessage, role: "user" })
    expect(result.status).toBeUndefined()
  })

  it("converts unknown block types to JSON text", () => {
    const message: ChatMessage = {
      ...baseMessage,
      contentBlocks: [
        { type: "unknown_type", data: "something" } as never,
      ],
    }

    const result = convertMessage(message)

    expect(result.content[0]).toMatchObject({
      type: "text",
      text: '{"type":"unknown_type","data":"something"}',
    })
  })
})

describe("convertStreamingMessage", () => {
  it("converts streaming parts maintaining order", () => {
    const state: StreamingMessageState = {
      id: "stream-1",
      parts: [
        { type: "thinking", text: "Hmm..." },
        { type: "text", text: "Here's my answer" },
      ],
      isComplete: false,
      isCompacting: false,
    }

    const result = convertStreamingMessage(state)

    expect(result.id).toBe("stream-1")
    expect(result.role).toBe("assistant")
    expect(result.content).toHaveLength(2)
    expect(result.content[0]).toEqual({ type: "reasoning", text: "Hmm..." })
    expect(result.content[1]).toEqual({ type: "text", text: "Here's my answer" })
  })

  it("sets running status when not complete", () => {
    const state: StreamingMessageState = {
      id: "s1",
      parts: [],
      isComplete: false,
      isCompacting: false,
    }

    const result = convertStreamingMessage(state)
    expect(result.status).toEqual({ type: "running" })
  })

  it("sets complete status when done", () => {
    const state: StreamingMessageState = {
      id: "s2",
      parts: [],
      isComplete: true,
      isCompacting: false,
    }

    const result = convertStreamingMessage(state)
    expect(result.status).toEqual({ type: "complete", reason: "stop" })
  })

  it("converts tool parts", () => {
    const state: StreamingMessageState = {
      id: "s3",
      parts: [
        {
          type: "tool",
          toolUseId: "tu-1",
          toolName: "Read",
          argsText: '{"file_path": "/x"}',
          isComplete: true,
          result: "content",
        },
      ],
      isComplete: false,
      isCompacting: false,
    }

    const result = convertStreamingMessage(state)

    expect(result.content[0]).toMatchObject({
      type: "tool-call",
      toolCallId: "tu-1",
      toolName: "Read",
      argsText: '{"file_path": "/x"}',
      result: "content",
    })
  })
})
