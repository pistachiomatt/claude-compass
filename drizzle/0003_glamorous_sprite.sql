-- Replace decomposed message fields with a single contentBlocks array
-- This stores raw Anthropic API content blocks for perfect fidelity

-- Add new column
ALTER TABLE "messages" ADD COLUMN "content_blocks" jsonb DEFAULT '[]'::jsonb;

-- Drop old columns
ALTER TABLE "messages" DROP COLUMN IF EXISTS "content";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "tool_calls";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "tool_responses";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "thinking";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "thinking_blocks";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "citations";
