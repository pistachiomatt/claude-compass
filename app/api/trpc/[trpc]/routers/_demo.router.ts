import { router, privateProcedure } from "../trpc"
import { Chat, Prompt } from "@/app/api/db"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import {
  ChatSchema,
  CreateChatSchema,
  SendMessageSchema,
  SendToolResponsesSchema,
  StreamMessageType,
  EditMessageSchema,
  DeleteMessageSchema,
  RollbackToMessageSchema,
} from "../schemas/_demo.schema"
import { createUniversalChatCompletion, StreamResponse } from "@/lib/api/universalAiApi"
import { respondWithCompletion, ToolCall } from "@/lib/respondWithCompletion"
import { substitutePromptVariables } from "@/lib/substitutePromptVariables"
import getUuid from "@/lib/getUuid"
import { MessageRole } from "@/app/types"
import { reject } from "lodash"
import { getChatMessagesFromString } from "@/lib/getChatMessagesFromString"

export const chatRouter = router({
  getById: privateProcedure
    .input(z.string())
    .output(ChatSchema)
    .query(async ({ input }) => {
      const chat = await Chat.findById(input)
      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        })
      }
      return chat
    }),

  create: privateProcedure
    .input(CreateChatSchema)
    .output(ChatSchema)
    .mutation(async ({ input }) => {
      const chat = new Chat({
        promptId: input.promptId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await chat.save()
      return chat
    }),

  sendMessageStream: privateProcedure.input(SendMessageSchema).subscription(async function* ({
    input: { id, chatId, content, isContentSkipped },
  }): AsyncGenerator<StreamMessageType, void, unknown> {
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat not found",
      })
    }

    const prompt = await Prompt.findById(chat.promptId)
    if (!prompt) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Prompt not found",
      })
    }

    // Add user message
    const sequenceNumber = (chat.messages?.length || 0) + 1
    if (!isContentSkipped) {
      const userMessage = {
        _id: id,
        role: MessageRole.USER,
        content,
        sequenceNumber,
        tool_calls: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      chat.messages = [...(chat.messages || []), userMessage]
      await chat.save()
    }

    try {
      const prefilledMessagesOai = getChatMessagesFromString(prompt.prefilledMessages || "")

      // Get chat history - format messages for OAI API
      const systemMessage = {
        role: MessageRole.SYSTEM as const,
        content: substitutePromptVariables(prompt.content, prompt.variables),
      }

      // Convert stored messages to OAI format (include tool_calls and tool_call_id)
      const formattedChatMessages = chat.messages.map(msg => {
        const base: any = { role: msg.role, content: msg.content }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          base.tool_calls = msg.tool_calls
        }
        if (msg.tool_call_id) {
          base.tool_call_id = msg.tool_call_id
        }
        return base
      })

      const chatMessages = [
        systemMessage,
        ...prefilledMessagesOai,
        ...formattedChatMessages,
        ...(prompt.preamble
          ? [{ role: "user", content: `<system:mai>${prompt.preamble}</system:mai>` }]
          : []),
      ]

      // Parse tools JSON if provided
      let parsedTools
      if (prompt.tools) {
        try {
          parsedTools = JSON.parse(prompt.tools)
        } catch (error) {
          console.error("Failed to parse tools JSON:", error)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid tools JSON format",
          })
        }
      }

      const responseStream = (await createUniversalChatCompletion({
        model: prompt.model,
        messages: chatMessages as any,
        temperature: prompt.temperature,
        stream: true,
        reasoning: prompt.isReasoning
          ? {
              max_tokens: 4000,
            }
          : undefined,
        tools: parsedTools,
        parallel_tool_calls: true,
        // provider: {
        //   only: ['google-vertex'],
        // },
      })) as StreamResponse

      // Add assistant message
      const assistantMessage = {
        _id: getUuid(),
        role: MessageRole.ASSISTANT,
        content: "•••",
        sequenceNumber: sequenceNumber + 1,
        tool_calls: [] as ToolCall[],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      chat.messages = [...chat.messages, assistantMessage]
      await chat.save()

      yield {
        _id: chat._id,
        promptId: chat.promptId,
        messages: [assistantMessage],
      }

      let finalToolCalls: ToolCall[] | undefined = undefined

      let finalContent = ""

      for await (const chunk of respondWithCompletion(responseStream, { isAccumulated: true })) {
        // Keep content and thinking separate for database vs frontend
        const contentOnly = chunk.content || ""
        const combinedContent = chunk.thinking
          ? `<think>\n${chunk.thinking}\n</think>\n\n${contentOnly}`
          : contentOnly

        if (chunk.tool_calls) {
          finalToolCalls = chunk.tool_calls
        }

        // Track final content for DB save
        finalContent = contentOnly

        // Yield combined content to frontend (tool_calls rendered by ChatMessage)
        yield {
          _id: chat._id,
          promptId: chat.promptId,
          messages: [
            {
              _id: assistantMessage._id,
              role: MessageRole.ASSISTANT,
              sequenceNumber: assistantMessage.sequenceNumber,
              content: combinedContent,
              tool_calls: chunk.tool_calls,
            },
          ],
        }
      }

      console.log("sendMessageStream:saving", {
        messageId: assistantMessage._id,
        contentLength: finalContent.length,
        hasToolCalls: !!finalToolCalls?.length,
      })

      // Ensure content is never empty for DB validation
      if (!finalContent) {
        finalContent = ""
      }

      await Chat.updateOne(
        { _id: chatId, "messages._id": assistantMessage._id },
        {
          $set: {
            "messages.$.content": finalContent,
            "messages.$.tool_calls": finalToolCalls || [],
          },
        },
      )

      yield "[DONE]"
    } catch (error: any) {
      console.error("sendMessageStream:failed", error)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error?.message,
      })
    }
  }),

  editMessage: privateProcedure
    .input(EditMessageSchema)
    .output(ChatSchema)
    .mutation(async ({ input: { chatId, messageId, content } }) => {
      const chat = await Chat.findById(chatId)
      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        })
      }

      chat.messages = chat.messages.map(message =>
        message._id === messageId ? { ...message, content, updatedAt: new Date() } : message,
      )

      await chat.save()
      return chat
    }),

  deleteMessage: privateProcedure
    .input(DeleteMessageSchema)
    .output(ChatSchema)
    .mutation(async ({ input: { chatId, messageId } }) => {
      const chat = await Chat.findById(chatId)
      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        })
      }

      chat.messages = reject(chat.messages, { _id: messageId })
      await chat.save()
      return chat
    }),

  rollbackToMessage: privateProcedure
    .input(RollbackToMessageSchema)
    .output(ChatSchema)
    .mutation(async ({ input: { chatId, messageId, isInclusive } }) => {
      const chat = await Chat.findById(chatId)
      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        })
      }

      const messageIndex = chat.messages.findIndex(m => m._id === messageId)
      if (messageIndex === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        })
      }

      const sliceIndex = isInclusive ? messageIndex : messageIndex + 1
      chat.messages = chat.messages.slice(0, sliceIndex)
      await chat.save()
      return chat
    }),

  /**
   * Send tool responses and get the next assistant message
   */
  sendToolResponsesStream: privateProcedure
    .input(SendToolResponsesSchema)
    .subscription(async function* ({
      input: { chatId, responses },
    }): AsyncGenerator<StreamMessageType, void, unknown> {
      const chat = await Chat.findById(chatId)
      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        })
      }

      const prompt = await Prompt.findById(chat.promptId)
      if (!prompt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Prompt not found",
        })
      }

      // Add tool response messages
      const baseSequenceNumber = (chat.messages?.length || 0) + 1
      const toolMessages = responses.map((response, index) => ({
        _id: getUuid(),
        role: MessageRole.TOOL as const,
        content: response.content,
        tool_call_id: response.tool_call_id,
        tool_calls: [] as ToolCall[],
        sequenceNumber: baseSequenceNumber + index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      chat.messages = [...(chat.messages || []), ...toolMessages]
      await chat.save()

      // Yield the tool messages to the frontend
      yield {
        _id: chat._id,
        promptId: chat.promptId,
        messages: toolMessages,
      }

      try {
        const prefilledMessagesOai = getChatMessagesFromString(prompt.prefilledMessages || "")

        // Get chat history - format messages for OAI API
        const systemMessage = {
          role: MessageRole.SYSTEM as const,
          content: substitutePromptVariables(prompt.content, prompt.variables),
        }

        // Convert stored messages to OAI format (include tool_calls and tool_call_id)
        const formattedChatMessages = chat.messages.map(msg => {
          const base: any = { role: msg.role, content: msg.content }
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            base.tool_calls = msg.tool_calls
          }
          if (msg.tool_call_id) {
            base.tool_call_id = msg.tool_call_id
          }
          return base
        })

        const chatMessages = [
          systemMessage,
          ...prefilledMessagesOai,
          ...formattedChatMessages,
          ...(prompt.preamble
            ? [{ role: "user", content: `<system:mai>${prompt.preamble}</system:mai>` }]
            : []),
        ]

        // Parse tools JSON if provided
        let parsedTools
        if (prompt.tools) {
          try {
            parsedTools = JSON.parse(prompt.tools)
          } catch (error) {
            console.error("Failed to parse tools JSON:", error)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid tools JSON format",
            })
          }
        }

        const responseStream = (await createUniversalChatCompletion({
          model: prompt.model,
          messages: chatMessages as any,
          temperature: prompt.temperature,
          stream: true,
          reasoning: prompt.isReasoning
            ? {
                max_tokens: 4000,
              }
            : undefined,
          tools: parsedTools,
          parallel_tool_calls: true,
        })) as StreamResponse

        // Add assistant message
        const assistantMessage = {
          _id: getUuid(),
          role: MessageRole.ASSISTANT,
          content: "•••",
          sequenceNumber: baseSequenceNumber + responses.length,
          tool_calls: [] as ToolCall[],
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        chat.messages = [...chat.messages, assistantMessage]
        await chat.save()

        yield {
          _id: chat._id,
          promptId: chat.promptId,
          messages: [assistantMessage],
        }

        let finalToolCalls: ToolCall[] | undefined = undefined
        let finalContent = ""

        for await (const chunk of respondWithCompletion(responseStream, { isAccumulated: true })) {
          // Keep content and thinking separate for database vs frontend
          const contentOnly = chunk.content || ""
          const combinedContent = chunk.thinking
            ? `<think>\n${chunk.thinking}\n</think>\n\n${contentOnly}`
            : contentOnly

          if (chunk.tool_calls) {
            finalToolCalls = chunk.tool_calls
          }

          // Track final content for DB save
          finalContent = contentOnly

          // Yield combined content to frontend (tool_calls rendered by ChatMessage)
          yield {
            _id: chat._id,
            promptId: chat.promptId,
            messages: [
              {
                _id: assistantMessage._id,
                role: MessageRole.ASSISTANT,
                sequenceNumber: assistantMessage.sequenceNumber,
                content: combinedContent,
                tool_calls: chunk.tool_calls,
              },
            ],
          }
        }

        console.log("sendToolResponsesStream:saving", {
          messageId: assistantMessage._id,
          contentLength: finalContent.length,
          hasToolCalls: !!finalToolCalls?.length,
        })

        // Ensure content is never empty for DB validation
        if (!finalContent) {
          finalContent = ""
        }

        await Chat.updateOne(
          { _id: chatId, "messages._id": assistantMessage._id },
          {
            $set: {
              "messages.$.content": finalContent,
              "messages.$.tool_calls": finalToolCalls || [],
            },
          },
        )

        yield "[DONE]"
      } catch (error: any) {
        console.error("sendToolResponsesStream:failed", error)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error?.message,
        })
      }
    }),
})
