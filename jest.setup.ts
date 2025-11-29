import "@testing-library/jest-dom"

// Polyfill for MongoDB Memory Server
const { TextEncoder, TextDecoder } = require("util")
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock environment variables for all tests
Object.assign(process.env, { NODE_ENV: "test" })

// Mock mongoose connection to prevent app from connecting during tests
jest.mock("mongoose", () => {
  const originalMongoose = jest.requireActual("mongoose")
  return {
    ...originalMongoose,
    connection: {
      ...originalMongoose.connection,
      readyState: 1, // Pretend we're already connected to prevent auto-connect
    },
    connect: jest.fn().mockResolvedValue({}),
    plugin: jest.fn(),
  }
})

// Mock the environment module globally
jest.mock("@/lib/env.server", () => ({
  env: {
    SIGNAL_PHONE_NUMBER: "+1234567890",
    ALT_SIGNAL_PHONE_NUMBER: "+1234567891",
    ALT_SIGNAL_REAL_PHONE_NUMBER: "+1234567892",
    CLAUDE_NAME: "Claude",
    REASONING_CLAUDE_NAME: "Reasoning",
    EMERGED_MODE_GROUP_IDS: [],
    INSTANT_RESPONSE_GROUP_IDS: [],
    WATCHED_GROUP_IDS: [],
    DISALLOWED_GROUP_IDS: [],
    MONGODB_URL: "mongodb://localhost:27017/test",
    REDIS_URL: "redis://localhost:6379",
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    CONCURRENCY: 5,
    TEMP_DIR: "/tmp",
    OPENAI_API_KEY: "test-openai-key",
    OPENROUTER_API_KEY: "test-openrouter-key",
    ANTHROPIC_API_KEY: "test-anthropic-key",
    FIRECRAWL_API_KEY: "test-firecrawl-key",
    PABLO_API_KEY: "test-pablo-key",
    PAST_REMINDERS_RECALL_COUNT: 3,
    RESPONSE_MESSAGES_MAX_COUNT: 50,
    GROUPME_BOT_ID: "test-groupme-bot-id",
    GROUPME_USER_ID: "test-user-id",
    CHEAPER_MODEL_CHAT_IDS: [],
    DREAM_RESPONSE_MESSAGES_MAX_COUNT: 50,
  },
}))

// Mock nanoid globally
jest.mock("nanoid", () => ({
  nanoid: () => "test-id-" + Math.random().toString(36).substr(2, 9),
  customAlphabet: () => () => "test-id-" + Math.random().toString(36).substr(2, 9),
}))
