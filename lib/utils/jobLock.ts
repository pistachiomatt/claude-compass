import { JobName, JobData, MainJobName } from "@/jobs/types"
import { jobQueue } from "@/jobs/queue"
import IORedis from "ioredis"
import { env } from "@/lib/env.server"

// Removed in-memory storage and use Redis for shared pending jobs
const redis = new IORedis(env.REDIS_URL)

// Helper to get a consistent key for the pending job in Redis
const getPendingJobKey = (chatId: string): string => `pending_job:${chatId}`

export async function isJobRunningForChat(chatId: string, jobName: JobName): Promise<boolean> {
  const activeJobs = await jobQueue.getActive()

  return activeJobs.some(job => {
    const data = job.data as JobData
    return job.name === jobName && "chatId" in data && data.chatId === chatId
  })
}

export async function addJobIfNotRunning(jobName: MainJobName, data: JobData): Promise<boolean> {
  const chatId = "chatId" in data ? data.chatId : null

  if (chatId && (await isJobRunningForChat(chatId, jobName))) {
    console.log(`[JobLock] Job ${jobName} already running for chat ${chatId}`)
    return false
  }

  await jobQueue.add(jobName, data)
  console.log(`[JobLock] Added job ${jobName} for chat ${chatId}`)
  return true
}

/**
 * Adds a job to the queue, or if a job with the same name is already running for the chat,
 * queues it to run after the currently running job completes.
 *
 * This ensures sequential processing of jobs for the same chat
 * without limiting overall concurrency.
 */
export async function addOrQueueDependentJob(
  jobName: MainJobName,
  data: JobData,
): Promise<boolean> {
  const chatId = "chatId" in data ? data.chatId : null
  if (!chatId) return false

  // First check if a job is already running
  if (!(await isJobRunningForChat(chatId, jobName))) {
    // No job running, add normally
    await jobQueue.add(jobName, data)
    console.log(`[JobLock] Added job ${jobName} for chat ${chatId}`)
    return true
  }

  // Check if we already have a pending job for this chat
  const pendingKey = getPendingJobKey(chatId)
  const existingPendingJob = await redis.exists(pendingKey)

  if (existingPendingJob) {
    console.log(
      `[JobLock] Already have a pending ${jobName} job for chat ${chatId}, ignoring this request`,
    )
    return false
  }

  // Store this job as the pending job for this chat in Redis
  await redis.set(pendingKey, JSON.stringify({ name: jobName, data }), "EX", 3600) // Expires in 1 hour
  console.log(
    `[JobLock] Stored pending ${jobName} job for chat ${chatId} to run after current job completes`,
  )
  return true
}

/**
 * Checks if there's a pending job for a completed job's chat
 * and adds it to the queue if found.
 *
 * This should be called when a job completes.
 */
export async function checkAndRunDependentJob(chatId: string): Promise<void> {
  const pendingKey = getPendingJobKey(chatId)
  const pendingJobJson = await redis.get(pendingKey)
  if (pendingJobJson) {
    // Remove it from Redis
    await redis.del(pendingKey)
    const pendingJob = JSON.parse(pendingJobJson)
    await jobQueue.add(pendingJob.name, pendingJob.data)
    console.log(`[JobLock] Running pending ${pendingJob.name} job for chat ${chatId}`)
  }
}
