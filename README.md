# Compass

A Claude-powered chat experience with a collaborative whiteboard UI. Chat with Claude in text while it illustrates thoughts on a Figjam-style canvas.

## Bits

- Node.js 24.x
- PostgreSQL
- Drizzle
- NextJS
- Claude Agent SDK

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env.local` file:

   ```bash
   # Required
   NEXT_PUBLIC_BASE_URL=http://localhost:3001
   DATABASE_URL=postgresql://user:password@localhost:5432/compass
   REDIS_URL=redis://localhost:6379
   CONCURRENCY=5
   TEMP_DIR=/tmp
   MAX_TURN_COUNT=50
   MAX_THINKING_TOKENS=10000

   # Optional - Vertex AI (alternative to direct Anthropic API)
   CLAUDE_CODE_USE_VERTEX=1
   CLOUD_ML_REGION=us-east5
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_VERTEX_AI_AUTH_JSON=<base64-encoded-service-account-json>

   # Optional - Voice transcription
   DEEPGRAM_API_KEY=your-deepgram-key
   ```

3. **Set up the database**
   ```bash
   npm run db:migrate
   ```

## Development

```bash
npm run dev
```

This starts:

- Next.js on http://localhost:3001
- Background worker for job processing
- Drizzle Studio on http://localhost:3801 (database UI)
