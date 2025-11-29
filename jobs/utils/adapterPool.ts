import type { ChatAdapter } from "@/lib/chat/types"
import { SignalAdapter } from "@/lib/chat/adapters/signal"
import { env } from "@/lib/env.server"
import { ChatPlatform } from "@/db/schema"
import { GroupMeAdapter } from "@/lib/chat/adapters/groupme"
import { EvalAdapter } from "@/lib/chat/adapters/eval"
import { handleReaction } from "@/lib/chat/processor/handleReaction"

/**
 * Singleton adapter pool for background job processing
 * Manages adapter instances to avoid creating new connections for each job
 */
class AdapterPool {
  private static instance: AdapterPool
  private adapters: Map<ChatPlatform, ChatAdapter> = new Map()
  private initializationPromises: Map<ChatPlatform, Promise<void>> = new Map()

  private constructor() {}

  static getInstance(): AdapterPool {
    if (!AdapterPool.instance) {
      AdapterPool.instance = new AdapterPool()
    }
    return AdapterPool.instance
  }

  /**
   * Gets or creates an adapter for the specified platform
   * Ensures only one adapter instance per platform
   */
  async getAdapter(platform: ChatPlatform): Promise<ChatAdapter> {
    // Check if adapter already exists
    const existingAdapter = this.adapters.get(platform)
    if (existingAdapter) {
      return existingAdapter
    }

    // Check if initialization is already in progress
    const initPromise = this.initializationPromises.get(platform)
    if (initPromise) {
      await initPromise
      return this.adapters.get(platform)!
    }

    // Create and initialize new adapter
    const initNewAdapter = async () => {
      let adapter: ChatAdapter

      switch (platform) {
        case "signal":
          adapter = new SignalAdapter(env.SIGNAL_PHONE_NUMBER)
          break
        case "slack":
          throw new Error("AdapterPool:notImplemented")
          break
        case "groupme":
          adapter = new GroupMeAdapter(env.GROUPME_API_KEY, env.GROUPME_BOT_ID, env.GROUPME_USER_ID)
          adapter.onReaction(async (reaction, context) => {
            try {
              await handleReaction(reaction, context)
            } catch (error) {
              console.error("Error processing GroupMe reaction:", error)
            }
          })
          break
        case "eval":
          adapter = new EvalAdapter()
          break
        default:
          throw new Error(`Unsupported platform: ${platform}`)
      }

      // Note: For workers, we don't need to connect WebSocket
      // as we're only sending messages, not receiving them
      // If we need bidirectional communication, we'd handle it differently

      this.adapters.set(platform, adapter)
    }

    // Store initialization promise to prevent race conditions
    const promise = initNewAdapter()
    this.initializationPromises.set(platform, promise)

    try {
      await promise
      return this.adapters.get(platform)!
    } finally {
      // Clean up initialization promise
      this.initializationPromises.delete(platform)
    }
  }

  /**
   * Disconnects all adapters
   * Useful for graceful shutdown
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.values()).map(adapter =>
      adapter.disconnect().catch(err => console.error("Error disconnecting adapter:", err)),
    )
    await Promise.all(disconnectPromises)
    this.adapters.clear()
  }

  /**
   * Disconnects a specific adapter
   */
  async disconnect(platform: ChatPlatform): Promise<void> {
    const adapter = this.adapters.get(platform)
    if (adapter) {
      await adapter.disconnect()
      this.adapters.delete(platform)
    }
  }
}

export const adapterPool = AdapterPool.getInstance()
