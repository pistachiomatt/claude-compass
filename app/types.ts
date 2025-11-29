// Claude model enum with canonical names
export enum ClaudeModel {
  OPUS_4_5 = "claude-opus-4-5@20251101",
  OPUS_4 = "claude-opus-4-1-20250805",
  SONNET_4 = "claude-sonnet-4-20250514",
  SONNET_4_5 = "claude-sonnet-4-5@20250929",
  SONNET_3_7 = "claude-3-7-sonnet-20250219",
  SONNET_3_5_V2 = "claude-3-5-sonnet-20241022",
  SONNET_3_5 = "claude-3-5-sonnet-20240620",
  HAIKU_3_5 = "claude-3-5-haiku-20241022",
  OPUS_3 = "claude-3-opus-20240229",
  SONNET_3 = "claude-3-sonnet-20240229",
  HAIKU_3 = "claude-3-haiku-20240307",
}

// Target models for different environments
export const TARGET_CHEAPER_MODEL = ClaudeModel.SONNET_4_5
export const TARGET_MODEL =
  process.env.NODE_ENV === "development" ? TARGET_CHEAPER_MODEL : ClaudeModel.OPUS_4_5
