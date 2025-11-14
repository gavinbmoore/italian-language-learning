# Conversation Memory System

## Overview

The conversation memory system provides long-term context for ChatGPT conversations by automatically generating and storing summaries, facts, topics, and user preferences from your Italian language learning conversations.

## How It Works

### Automatic Memory Generation

Every 20 messages (configurable), the system automatically:

1. **Generates a Summary** - Creates a 2-3 sentence summary of recent conversations
2. **Extracts Key Facts** - Identifies important information like:
   - User preferences (topics they enjoy, learning goals)
   - Personal information (name, interests, profession)
   - Topics discussed
   - Common mistakes or corrections

### Memory Retrieval

When generating AI responses, the system:

1. Retrieves the top 3 most important and recently used memories
2. Injects them into the ChatGPT system prompt
3. Maintains the last 10 messages as immediate context
4. Combines both for rich, personalized conversations

## Memory Types

- **summary** - Concise overviews of conversation history
- **fact** - Personal information about the user
- **topic** - Subjects discussed in conversations
- **preference** - User's interests and learning goals
- **correction** - Common mistakes to watch for

## Configuration

Environment variables (optional):

```env
MEMORY_GENERATION_INTERVAL=20    # Generate memories every N messages
MAX_MEMORIES_PER_REQUEST=3       # How many memories to include in context
```

## Database Schema

### Table: `conversation_memory`

```sql
CREATE TABLE "app"."conversation_memory" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "memory_type" text NOT NULL,
  "content" text NOT NULL,
  "context" text,
  "importance" integer DEFAULT 5,
  "created_at" timestamp DEFAULT now(),
  "last_used_at" timestamp DEFAULT now(),
  "metadata" jsonb
);
```

### Indexes

- `user_id` - Fast user lookups
- `memory_type` - Filter by type
- `importance DESC` - Prioritize important memories
- `last_used_at DESC` - Recent usage tracking
- Composite index on `(user_id, importance, last_used_at)` for optimal retrieval

## API Endpoints

### Generate Memories (Manual)

```http
POST /api/v1/protected/comprehensible-input/memory/generate
```

Manually trigger memory generation (useful for testing).

**Response:**
```json
{
  "message": "Memories generated successfully"
}
```

### Get All Memories

```http
GET /api/v1/protected/comprehensible-input/memory?limit=50
```

Retrieve stored memories for the current user.

**Response:**
```json
{
  "memories": [
    {
      "id": "memory-123",
      "user_id": "user-456",
      "memory_type": "summary",
      "content": "User has been practicing Italian verbs...",
      "importance": 7,
      "created_at": "2025-11-11T12:00:00Z",
      "last_used_at": "2025-11-11T14:30:00Z"
    }
  ],
  "count": 1
}
```

### Delete a Memory

```http
DELETE /api/v1/protected/comprehensible-input/memory/:memoryId
```

Remove a specific memory.

**Response:**
```json
{
  "message": "Memory deleted successfully"
}
```

## Frontend Integration

```typescript
import { api } from '@/lib/serverComm';

// Manually generate memories
await api.generateMemories();

// View stored memories
const { memories } = await api.getConversationMemories(50);

// Delete a memory
await api.deleteConversationMemory('memory-id-123');
```

## How It Improves Conversations

### Without Memory System
- ChatGPT only sees last 10 messages
- No awareness of past topics or preferences
- Conversations feel disconnected over time
- Limited personalization

### With Memory System
- ChatGPT remembers topics from weeks ago
- Recognizes user's interests and learning goals
- Can reference previous conversations naturally
- Highly personalized learning experience
- Maintains continuity across sessions

## Example Memory Injection

When a user starts a new conversation, ChatGPT receives:

```
SYSTEM PROMPT:
You are an Italian language learning assistant...
[standard instructions]

--- CONVERSATION MEMORY ---
Use this context to make the conversation more personalized:

Previous Conversation Context:
- User has been practicing Italian food vocabulary and expressing preferences
- Last conversation focused on ordering in restaurants

Known Facts About User:
- User's name is Sarah
- User is learning Italian for an upcoming trip to Rome
- User works as a software engineer

User Preferences:
- Enjoys talking about technology and travel
- Prefers practical, everyday conversation topics
- Learning goal: Be conversational by March 2025

Topics Discussed:
- Italian cuisine and restaurants
- Travel planning for Italy
- Basic greetings and introductions
```

## Token Usage

### Cost Analysis

- **Summary generation**: ~200-300 tokens per summary
- **Fact extraction**: ~100-150 tokens per extraction
- **Memory injection**: ~50-200 tokens per conversation turn

### Net Savings

Without memory system:
- Sending 50 full messages: ~2000+ tokens per request

With memory system:
- 3 summaries + 10 recent messages: ~800-1000 tokens per request
- **Savings: ~50% token reduction** while maintaining better context

## Migration

To apply the database schema:

```bash
cd server
# Run the migration
psql $DATABASE_URL < drizzle/0002_add_conversation_memory.sql
```

Or use Drizzle Kit:

```bash
cd server
npm run db:push
```

## Monitoring

Check server logs for memory generation events:

```
Auto-generating memories for user user-123...
✓ Memories generated for user user-123
Generated memories for user user-123: 1 summary, 3 facts
```

## Troubleshooting

### Memories not generating

**Check:**
1. At least 20 messages have been exchanged since last summary
2. OpenAI API key is configured correctly
3. Server logs for errors

### Memory retrieval issues

**Check:**
1. Database connection is working
2. `conversation_memory` table exists
3. User has stored memories (`GET /memory` endpoint)

### Poor memory quality

**Adjust:**
- Model settings in `conversation-memory.ts`
- System prompts for summary/fact extraction
- Importance scores for memory prioritization

## Future Enhancements

Potential improvements:

1. **Semantic Search** - Use embeddings to find relevant memories based on topic
2. **Memory Decay** - Gradually reduce importance of old memories
3. **User-Editable Memories** - Let users add/edit their own memory facts
4. **Memory Categories** - Organize by topics, goals, corrections
5. **Memory Analytics** - Show what the AI remembers about the user
6. **Export/Import** - Backup and restore conversation memories

## Best Practices

1. **Review memories periodically** - Use the GET endpoint to see what's stored
2. **Delete irrelevant memories** - Keep memory bank focused and useful
3. **Let the system work** - 20 messages is a good threshold, don't over-generate
4. **Monitor token usage** - Check OpenAI dashboard for costs
5. **Test memory quality** - Manually trigger generation and review results

## See Also

- [OpenAI Integration Docs](./OPENAI_INTEGRATION.md)
- [ChatGPT Setup Guide](../CHATGPT_SETUP.md)
- [API Documentation](../server/README.md)

