import Anthropic from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { GoogleAuth } from "google-auth-library"
import { env } from "../env.server"
import { ClaudeModel } from "@/app/types"

// Define the provider enum
export enum AnthropicProvider {
  NATIVE = "native",
  BEDROCK = "bedrock",
  VERTEX = "vertex",
}

// Initialize Vertex AI client with proper authentication
const createVertexClient = () => {
  const options: any = {
    baseURL: "https://aiplatform.googleapis.com/v1",
    projectId: "coco-mai",
    region: "global",
  }

  // If we have the JSON auth string, use it
  if (!env.GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON) {
    throw new Error("GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON is not set")
  }

  const credentials = env.GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON
  options.googleAuth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  })

  return new AnthropicVertex(options)
}

/**
 * Convert model name to native Anthropic format
 * Handles both ClaudeModel enum values
 */
export function toNativeModel(model: string | ClaudeModel): string {
  if (Object.values(ClaudeModel).includes(model as ClaudeModel)) {
    return model
  } else {
    throw new Error(`Unsupported model: ${model}`)
  }
}

/**
 * Convert model name to Vertex AI format
 */
function toVertexModel(model: string | ClaudeModel): string {
  const nativeModel = toNativeModel(model)

  const vertexMapping: Record<string, string> = {
    [ClaudeModel.OPUS_4_5]: "claude-opus-4-5@20251101",
    [ClaudeModel.OPUS_4]: "claude-opus-4@20250514",
    [ClaudeModel.SONNET_4]: "claude-sonnet-4@20250514",
    [ClaudeModel.SONNET_4_5]: "claude-sonnet-4-5@20250929",
    [ClaudeModel.SONNET_3_7]: "claude-3-7-sonnet@20250219",
    [ClaudeModel.SONNET_3_5_V2]: "claude-3-5-sonnet-v2@20241022",
    [ClaudeModel.SONNET_3_5]: "claude-3-5-sonnet@20240620",
    [ClaudeModel.HAIKU_3_5]: "claude-3-5-haiku@20241022",
    [ClaudeModel.OPUS_3]: "claude-3-opus@20240229",
    [ClaudeModel.SONNET_3]: "claude-3-sonnet@20240229",
    [ClaudeModel.HAIKU_3]: "claude-3-haiku@20240307",
  }

  return vertexMapping[nativeModel] || nativeModel
}

export async function createAnthropicChatCompletion(
  params: Anthropic.MessageCreateParamsNonStreaming | Anthropic.MessageCreateParamsStreaming,
  provider: AnthropicProvider = AnthropicProvider.VERTEX,
) {
  const anthropicVertex = createVertexClient()

  try {
    if (provider === AnthropicProvider.VERTEX) {
      const vertexParams = {
        ...params,
        model: toVertexModel(params.model),
      }
      // lazy load the Vertex client, so it does not fail at build time due to missing credentials
      const response = await anthropicVertex.messages.create(vertexParams)
      return response
    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }
  } catch (error) {
    console.error(`Error in createAnthropicChatCompletion with provider ${provider}:`, error)
    throw error
  }
}
