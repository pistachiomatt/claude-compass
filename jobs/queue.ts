import { Queue, JobsOptions } from "bullmq"
import { MainJobName, JobData } from "./types"
import { env } from "@/lib/env.server"

export const jobQueue = new Queue<JobData, any, MainJobName>("compassQueue", {
  connection: {
    url: env.REDIS_URL,
  },
  defaultJobOptions: {
    attempts: 1, // No retries
    removeOnComplete: 10, // Keep last 10 completed jobs for debugging
    removeOnFail: 50, // Keep last 50 failed jobs for debugging
  },
})

export const addJob = async (name: MainJobName, data: JobData, options?: JobsOptions) => {
  const job = await jobQueue.add(name, data, options)
  if (options?.delay) {
    const scheduledTime = new Date(Date.now() + options.delay)
    console.log(
      `[Queue] Added delayed job ${job.id} of type ${name} - scheduled for ${scheduledTime.toLocaleTimeString()}`,
    )
  } else {
    console.log(`[Queue] Added job ${job.id} of type ${name}`)
  }
  return job
}

export const getJobCounts = async () => {
  const counts = await jobQueue.getJobCounts()
  console.log(`[Queue] Current job counts:`, counts)
  return counts
}

// Function to clean up old jobs more comprehensively
export const cleanupOldJobs = async () => {
  console.log(`[Queue] Starting comprehensive job cleanup`)

  try {
    // Clean up completed jobs beyond the retention limit
    await jobQueue.clean(24 * 60 * 60 * 1000, 100, "completed") // Remove completed jobs older than 24 hours, keep max 100
    console.log(`[Queue] Cleaned up old completed jobs`)

    // Clean up failed jobs beyond the retention limit
    await jobQueue.clean(7 * 24 * 60 * 60 * 1000, 200, "failed") // Remove failed jobs older than 7 days, keep max 200
    console.log(`[Queue] Cleaned up old failed jobs`)

    // Clean up active jobs that might be stalled (be more conservative here)
    await jobQueue.clean(2 * 60 * 60 * 1000, 0, "active") // Remove active jobs older than 2 hours
    console.log(`[Queue] Cleaned up potentially stalled active jobs`)

    const counts = await jobQueue.getJobCounts()
    console.log(`[Queue] Job cleanup complete. Current counts:`, counts)
  } catch (error) {
    console.error(`[Queue] Error during job cleanup:`, error)
  }
}

// Set up periodic cleanup every 6 hours for more frequent maintenance
if (process.env.NODE_ENV !== "test") {
  setInterval(cleanupOldJobs, 6 * 60 * 60 * 1000)
}
