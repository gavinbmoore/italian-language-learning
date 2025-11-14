# OpenAI ChatGPT Integration

This document describes how the OpenAI ChatGPT API is integrated into the learning app to provide comprehensible input (i+1) conversations.

## Overview

The app uses OpenAI's ChatGPT API to generate Italian language responses that maintain the optimal comprehensibility level of 80-85% for the user. This follows the "i+1" principle from language acquisition theory, where content should be just slightly above the learner's current level.

## Setup

### 1. Install Dependencies

The OpenAI SDK is required in the server package:

```bash
cd learning-app/server
npm install openai
```

Or if you use pnpm:

```bash
cd learning-app/server
pnpm install
```

### 2. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (you won't be able to see it again)

### 3. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cd learning-app/server
cp .env.example .env
```

Edit the `.env` file and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Important**: Never commit your `.env` file to version control!

## How It Works

### Architecture

1. **User sends a message** in Italian
2. **Backend analyzes** the user's proficiency level and vocabulary
3. **ChatGPT generates** a response tailored to maintain 80-85% comprehensibility
4. **System tracks** new vocabulary and updates user proficiency
5. **Response is saved** and displayed to the user

### Key Components

#### `/server/src/lib/openai-chat.ts`

Contains the core OpenAI integration logic:

- `generateComprehensibleResponse()`: Main function that generates AI responses
- `buildSystemPrompt()`: Creates prompts based on user's CEFR level
- `generateChatResponse()`: Handles conversation context
- Automatic retry mechanism if comprehensibility is out of range

#### `/server/src/api.ts`

API endpoint:
- `POST /api/v1/protected/comprehensible-input/conversation/generate`
  - Takes user message
  - Gets conversation history (last 10 messages)
  - Generates AI response
  - Tracks vocabulary
  - Returns response with analysis

#### `/ui/src/pages/ComprehensibleInput.tsx`

Frontend component that:
- Displays conversation interface
- Sends messages to backend
- Shows comprehensibility scores
- Allows marking words as known
- Displays learning statistics

### System Prompt Strategy

The system is instructed to:

1. **Write entirely in Italian** (target language)
2. **Maintain 82.5% comprehensibility** (target score)
3. **Introduce 1-3 new words** naturally in context
4. **Use appropriate structures** for the user's CEFR level (A1-C2)
5. **Keep responses short** (2-4 sentences)
6. **Be conversational and engaging**

### Adaptive Difficulty

The system automatically adjusts if responses are:
- **Too difficult** (< 75% comprehensibility): Simplifies language
- **Too easy** (> 90% comprehensibility): Increases complexity
- **Just right** (75-90%): Maintains current approach

### Retry Mechanism

Up to 3 attempts are made to generate a response in the target range. If all attempts fail, the system returns the best (closest to target) response.

## Cost Considerations

### Token Usage

- Model: `gpt-4o-mini` (cost-effective)
- Max tokens per response: 300
- Includes conversation context (last 10 messages)
- System prompt: ~300 tokens

### Estimated Costs

Based on OpenAI pricing (as of November 2024):

**gpt-4o-mini**:
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens
- Average per conversation turn: ~$0.0003-0.0005

**For 1000 conversation turns**:
- Cost: ~$0.30-0.50

### Cost Optimization Tips

1. **Use gpt-4o-mini** instead of gpt-4 (10x cheaper)
2. **Limit conversation history** to last 10 messages
3. **Set max_tokens** to reasonable limit (300)
4. **Cache user proficiency** data
5. **Monitor usage** through OpenAI dashboard

## Model Options

You can change the model in `/server/src/lib/openai-chat.ts`:

```typescript
const completion = await client.chat.completions.create({
  model: 'gpt-4o-mini', // Options: 'gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo'
  // ... other options
});
```

### Model Comparison

| Model | Quality | Speed | Cost | Recommended For |
|-------|---------|-------|------|-----------------|
| gpt-4o-mini | Good | Fast | Low | Production (default) |
| gpt-4o | Excellent | Fast | Medium | Premium users |
| gpt-4 | Excellent | Medium | High | Maximum quality |
| gpt-3.5-turbo | Fair | Very Fast | Very Low | Testing only |

## API Response Format

```json
{
  "conversationId": "uuid",
  "response": "Ciao! Come stai oggi?",
  "comprehensibilityScore": 0.825,
  "adjustment": "maintain",
  "tokensUsed": 245,
  "analysis": {
    "comprehensibilityScore": 0.825,
    "knownWords": 33,
    "newWords": 7,
    "totalWords": 40,
    "newWordList": ["oggi", "stai"],
    "knownWordList": ["ciao", "come", "?"]
  },
  "message": "AI response generated successfully"
}
```

## Testing

### Test OpenAI Connection

You can test the OpenAI connection:

```typescript
import { testOpenAIConnection } from './lib/openai-chat';

const isConnected = await testOpenAIConnection();
console.log('OpenAI connected:', isConnected);
```

### Test Endpoint

Using curl:

```bash
curl -X POST http://localhost:8787/api/v1/protected/comprehensible-input/conversation/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"userMessage": "Ciao! Come stai?"}'
```

## Troubleshooting

### Error: "OPENAI_API_KEY environment variable is not set"

**Solution**: Make sure you have created a `.env` file in the `server` directory with your API key.

### Error: "OpenAI API error: 401 Unauthorized"

**Solution**: Your API key is invalid or expired. Generate a new one from OpenAI dashboard.

### Error: "OpenAI API error: 429 Too Many Requests"

**Solution**: You've hit rate limits. Either:
- Wait a few minutes
- Upgrade your OpenAI plan
- Implement request queuing/throttling

### Error: "Failed to generate response after 3 attempts"

**Solution**: 
- Check your internet connection
- Verify OpenAI API status
- Check if your API key has available credits
- Review console logs for specific error details

## Monitoring

### Track Usage

Monitor your usage in the OpenAI dashboard:
1. Go to [platform.openai.com/usage](https://platform.openai.com/usage)
2. View token usage and costs
3. Set up billing alerts

### Logging

The system logs:
- Each API call attempt
- Comprehensibility scores
- Adjustment decisions
- Errors and retries

Check server logs for details:

```bash
# If running with npm/pnpm
npm run dev

# Watch for OpenAI-related logs
```

## Future Enhancements

Potential improvements:

1. **Streaming responses** for real-time display
2. **Voice integration** with OpenAI's TTS/STT
3. **Custom fine-tuning** for better Italian language learning
4. **Multi-language support** (Spanish, French, etc.)
5. **Conversation topics** based on user interests
6. **Spaced repetition** integration for vocabulary
7. **Grammar explanations** for complex structures

## Security Notes

- ✅ API key stored in environment variables
- ✅ Never exposed to frontend
- ✅ Protected by authentication middleware
- ✅ Rate limiting recommended for production
- ⚠️ Add request validation and sanitization
- ⚠️ Implement usage quotas per user
- ⚠️ Monitor for abuse/excessive usage

## Support

For issues related to:
- **OpenAI API**: [OpenAI Help Center](https://help.openai.com/)
- **This integration**: Check application logs and documentation
- **Billing**: [OpenAI Billing Dashboard](https://platform.openai.com/account/billing)

