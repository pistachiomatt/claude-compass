import { Worker, Job } from "bullmq"
import { MainJobName, JobData } from "./types"
import { env } from "@/lib/env.server"
import { checkAndRunDependentJob } from "@/lib/utils/jobLock"

const jobHandlers: Record<MainJobName, (job: Job<JobData, any, MainJobName>) => Promise<void>> = {
  // createResponse: async job => {
  //   const data = job.data as CreateResponseJobData
  //   const { chatId, platform } = data
  //   console.log(`[Worker] Starting createResponse job for chat ${chatId} on platform ${platform}`)
  //   try {
  //     // Create platform-specific context
  //     const context = await createChatContext({ chatId, platform })
  //     // Call createResponse with context
  //     await createResponse(data, context)
  //     console.log(`[Worker] Completed createResponse job for chat ${chatId}`)
  //   } catch (error) {
  //     console.error(`[Worker] Error in createResponse job for chat ${chatId}:`, error)
  //     throw error
  //   }
  // },
}

const processJob = async (job: Job<JobData, any, MainJobName>) => {
  const chatId = (job.data as any).chatId
  console.log(`[Worker] Processing job ${job.id} of type ${job.name} for chat ${chatId}`)
  const handler = jobHandlers[job.name]
  if (!handler) {
    console.error(`[Worker] No handler found for job type: ${job.name}`)
    throw new Error(`No handler found for job type: ${job.name}`)
  }
  try {
    await handler(job)
    console.log(
      `[Worker] Job ${job.id} of type ${job.name} completed successfully for chat ${chatId}`,
    )
  } catch (error) {
    console.error(
      `[Worker] Error processing job ${job.id} of type ${job.name} for chat ${chatId}:`,
      error,
    )
    throw error
  }
}

export const startWorker = () => {
  // Workers need proper settings for handling job liveliness
  const worker = new Worker<JobData, any, MainJobName>("compassQueue", processJob, {
    connection: {
      url: env.REDIS_URL,
    },
    concurrency: env.CONCURRENCY,
    // These settings help prevent jobs from stalling
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    lockDuration: 90000, // Keep lock for 90 seconds
  })

  console.log(`[Worker] Started with concurrency ${env.CONCURRENCY}`)

  worker.on("completed", async job => {
    console.log(`[Worker] Job ${job.id} has completed`)

    // Also check for pending jobs here in case QueueEvents missed it
    if ("chatId" in job.data) {
      const chatId = job.data.chatId

      // Check and run any pending job for this chat
      await checkAndRunDependentJob(chatId)
    }
  })

  worker.on("failed", (job, err) => {
    console.error(`\x1b[31m[Worker] Job ${job?.id} has failed with ${err.message}\x1b[0m`)
  })

  return worker
}

const worker = startWorker()

// Graceful shutdown with timeout
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, closing worker...`)

  const timeout = setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit")
    process.exit(1)
  }, 1000)

  try {
    // Close worker first
    await Promise.race([
      worker.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Worker close timeout")), 200)),
    ])
    console.log("Worker closed successfully")

    clearTimeout(timeout)
    console.log("Graceful shutdown complete")
    process.exit(0)
  } catch (error) {
    console.error("Error during graceful shutdown:", error)
    clearTimeout(timeout)
    process.exit(1)
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason)
  process.exit(1)
})
