import { ChatPlatform } from "@/db/schema"

// Non-tool job data types
export interface CreateResponseJobData {
  chatId: string
  platform: ChatPlatform
  ephemeralInstruction?: string
}

export type JobData = CreateResponseJobData

export type MainJobName = "createResponse"

export type JobName = MainJobName

export interface Job {
  name: JobName
  data: JobData
}
