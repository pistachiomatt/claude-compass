# Compass

A Claude-powered chat experience with a collaborative whiteboard UI. Chat with Claude in text while it illustrates thoughts on a Figjam-style canvas.

## Bits

- Node.js 24.x
- PostgreSQL
- Drizzle
- NextJS
- Claude Agent SDK

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ ChatContainer│  │ ClusterGrid  │  │ Thread (assistant-ui) │  │
│  └──────┬───────┘  └──────────────┘  └───────────────────────┘  │
│         │ useChatStream                                         │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ tRPC Client (subscriptions for streaming)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (tRPC)                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ chat.router.ts (sendMessageStream, updateWhiteboard)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ agentSession.ts (Claude Agent SDK orchestration)         │   │
│  │  • Hydrates virtual filesystem to temp dir               │   │
│  │  • Runs SDK with Read/Write/Edit tools                   │   │
│  │  • Streams events back to client                         │   │
│  │  • Syncs file changes back to DB                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ chatRepository.ts (Drizzle ORM)                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │  (chats, msgs,  │
                    │   virtual files)│
                    └─────────────────┘
```

- `./components/cluster-grid` is the React sticky notes whiteboard. It renders the whiteboard in schematised YML format that Claude also maintains.
- `./lib/agent/agentSession.ts` is a thin wrapper around the Claude Agent SDK which handles all the agentic AI logic.
- Whiteboard: Claude has a filesystem per chat synced between the tmp filesystem and the database (virtually storing the filesystem). When Claude edits `whiteboard.yml`, the UI renders it as draggable sticky notes. Users can drag items around, which writes back to the file - so Claude sees the updated positions on its next turn.

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
