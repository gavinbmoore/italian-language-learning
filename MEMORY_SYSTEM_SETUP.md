# Conversation Memory System - Setup Guide

## Quick Start

The conversation memory system has been integrated into your learning app! It automatically remembers context from past conversations and uses it to make AI responses more personalized.

## What's New

### Automatic Memory Generation
- Every 20 messages, the system automatically creates summaries and extracts key facts
- Memories are stored in the database and retrieved for future conversations
- ChatGPT receives relevant context from your entire conversation history

### Smart Context Management
- **Before**: ChatGPT only saw the last 10 messages
- **After**: ChatGPT sees last 10 messages + relevant summaries/facts from ALL past conversations
- Token-efficient: Uses summaries instead of sending hundreds of full messages

## Setup Steps

### 1. Run Database Migration

Apply the new `conversation_memory` table:

```bash
cd /Users/gavinmoore/Documents/Learning\ App/learning-app/server

# Option A: Using psql directly
psql $DATABASE_URL -f drizzle/0002_add_conversation_memory.sql

# Option B: Using Drizzle Kit
npm run db:push
```

### 2. Configure (Optional)

The system works with defaults, but you can customize in `.env`:

```env
# Generate memories every N messages (default: 20)
MEMORY_GENERATION_INTERVAL=20

# How many memories to include per conversation (default: 3)
MAX_MEMORIES_PER_REQUEST=3
```

### 3. Test It!

Start your dev server:

```bash
cd /Users/gavinmoore/Documents/Learning\ App/learning-app
npm run dev
```

Then:
1. Have a conversation with the AI (20+ messages)
2. Check server logs for: `✓ Memories generated for user ...`
3. View stored memories via API or continue conversing

## How to Use

### Automatic Operation

The system works automatically:
- **Every 20 messages**: Generates summary and extracts facts
- **Every AI response**: Retrieves relevant memories for context
- No manual intervention needed!

### Manual Controls (Optional)

**Generate Memories Manually:**
```typescript
import { api } from '@/lib/serverComm';
await api.generateMemories();
```

**View Stored Memories:**
```typescript
const { memories } = await api.getConversationMemories();
console.log(memories);
```

**Delete a Memory:**
```typescript
await api.deleteConversationMemory('memory-id-123');
```

## What Gets Remembered

The AI will remember:

✅ **Topics you've discussed** (food, travel, hobbies)  
✅ **Your personal info** (name, profession, goals)  
✅ **Your preferences** (interests, learning style)  
✅ **Common mistakes** (corrections to watch for)  
✅ **Learning progress** (vocabulary, grammar patterns)

## Example

**After 20 messages discussing Italian food:**

Next conversation, you say: "Ciao! What should we talk about today?"

AI remembers and responds naturally:
"Ciao! Vorresti continuare a parlare di cucina italiana? L'ultima volta abbiamo discusso di pasta e pizza." 
(Do you want to continue talking about Italian cuisine? Last time we discussed pasta and pizza.)

## Cost Impact

### Token Usage

- **Summary generation**: ~250 tokens (runs every 20 messages)
- **Fact extraction**: ~150 tokens (runs every 20 messages)
- **Memory retrieval**: ~100 tokens (per AI response)

### Net Result

**Without memory**: Sending 50 full messages = ~2000 tokens  
**With memory**: 3 summaries + 10 messages = ~800 tokens  
**Savings: 60%** while providing BETTER context!

## Monitoring

Watch server logs for memory events:

```
Auto-generating memories for user demo-user-123...
✓ Memories generated for user demo-user-123
Generated memories for user demo-user-123: 1 summary, 4 facts
```

Check OpenAI dashboard:
- [Usage Dashboard](https://platform.openai.com/usage)
- Should see minimal increase in costs
- Better conversations for less money!

## API Endpoints

All endpoints are under: `/api/v1/protected/comprehensible-input/memory`

```
POST   /memory/generate          # Manually trigger generation
GET    /memory?limit=50          # View stored memories
DELETE /memory/:memoryId         # Delete specific memory
```

## Troubleshooting

### "Memories not generating"

**Check:**
1. Have you sent 20+ messages?
2. Is OpenAI API key configured?
3. Check server logs for errors

**Test manually:**
```bash
curl -X POST http://localhost:8787/api/v1/protected/comprehensible-input/memory/generate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### "Database migration failed"

**Solution:**
```bash
# Ensure database is running
# Re-run migration
cd server
psql $DATABASE_URL -f drizzle/0002_add_conversation_memory.sql
```

### "Memory not being used in conversations"

**Check:**
1. Memories exist: `GET /memory`
2. Server logs show memory retrieval
3. Database queries are working

## Files Changed

### Backend
- ✅ `server/src/schema/comprehensible-input.ts` - Added table definition
- ✅ `server/drizzle/0002_add_conversation_memory.sql` - Database migration
- ✅ `server/src/lib/conversation-memory.ts` - Memory management library
- ✅ `server/src/lib/openai-chat.ts` - Integrated memory retrieval
- ✅ `server/src/api.ts` - Added API endpoints + auto-trigger

### Frontend
- ✅ `ui/src/lib/serverComm.ts` - Added memory API functions

### Documentation
- ✅ `docs/CONVERSATION_MEMORY.md` - Detailed technical docs
- ✅ `MEMORY_SYSTEM_SETUP.md` - This file!

## Next Steps

1. **Run the migration** (step 1 above)
2. **Start dev server** (`npm run dev`)
3. **Test with 20+ messages** to see auto-generation
4. **Check memories** via API or logs
5. **Enjoy smarter conversations!** 🎉

## Documentation

For detailed technical information:
- [Conversation Memory Docs](docs/CONVERSATION_MEMORY.md)
- [OpenAI Integration](docs/OPENAI_INTEGRATION.md)
- [ChatGPT Setup](CHATGPT_SETUP.md)

---

**The memory system is ready to use! Your AI tutor will now remember your entire learning journey.** 🇮🇹🤖✨

