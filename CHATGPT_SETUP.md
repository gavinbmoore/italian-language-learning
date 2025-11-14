# ChatGPT API Integration - Quick Setup Guide

## Overview

Your learning app now includes ChatGPT integration for comprehensible input conversations! The AI will automatically adjust its Italian responses to maintain 80-85% comprehensibility for each user's level.

## Quick Start

### 1. Install OpenAI Package

```bash
cd learning-app/server
npm install openai
```

If you're using pnpm:
```bash
cd learning-app
pnpm install
```

### 2. Get Your OpenAI API Key

1. Visit [platform.openai.com](https://platform.openai.com/)
2. Sign in or create an account
3. Go to **API Keys** section
4. Click **Create new secret key**
5. Copy the key (save it - you won't see it again!)

### 3. Configure Environment

Create `.env` file in the `server` directory:

```bash
cd learning-app/server
touch .env
```

Add your API key to `.env`:

```env
OPENAI_API_KEY=sk-your-actual-key-here

# Other existing config
DATABASE_URL=postgresql://postgres:password@localhost:5502/postgres
FIREBASE_PROJECT_ID=your_firebase_project_id
NODE_ENV=development
```

**Important:** Never commit `.env` to git!

### 4. Test the Integration

Start your server:

```bash
cd learning-app
npm run dev
```

Then:
1. Open your UI at `http://localhost:5173`
2. Go to the **Comprehensible Input** page
3. Type a message in Italian (e.g., "Ciao! Come stai?")
4. Watch ChatGPT respond with appropriate difficulty!

## What Was Changed

### Backend (Server)

**New Files:**
- `server/src/lib/openai-chat.ts` - OpenAI integration logic
- `server/.env.example` - Environment template
- `docs/OPENAI_INTEGRATION.md` - Detailed documentation

**Modified Files:**
- `server/src/api.ts` - Added `/conversation/generate` endpoint
- `server/src/lib/comprehensible-input.ts` - Fixed return type
- `server/package.json` - Added openai dependency

### Frontend (UI)

**Modified Files:**
- `ui/src/lib/serverComm.ts` - Added `generateAIResponse()` function
- `ui/src/pages/ComprehensibleInput.tsx` - Uses real AI instead of mock responses

## How It Works

```
User Message (Italian)
    ↓
Backend analyzes comprehensibility
    ↓
ChatGPT generates response at user's level
    ↓
System tracks new vocabulary
    ↓
Response displayed with analysis
```

## Features

✅ **Adaptive Difficulty** - Automatically adjusts to maintain 80-85% comprehensibility
✅ **Vocabulary Tracking** - Tracks new words from each conversation
✅ **CEFR-Based** - Adjusts complexity based on A1-C2 levels
✅ **Conversation Context** - Remembers last 10 messages
✅ **Retry Logic** - Up to 3 attempts to get optimal difficulty
✅ **Cost Efficient** - Uses gpt-4o-mini (cheap but good quality)

## Cost Estimates

Using `gpt-4o-mini`:
- **Per conversation turn:** ~$0.0003-0.0005
- **1000 conversations:** ~$0.30-0.50
- **10,000 conversations:** ~$3.00-5.00

Much cheaper than gpt-4!

## Monitoring Usage

Check your OpenAI dashboard:
- Usage: [platform.openai.com/usage](https://platform.openai.com/usage)
- Billing: [platform.openai.com/account/billing](https://platform.openai.com/account/billing)

Set up billing alerts to avoid surprises!

## Troubleshooting

### "Cannot find module 'openai'"

**Solution:** Run `npm install openai` in the server directory

### "OPENAI_API_KEY environment variable is not set"

**Solution:** Create `.env` file with your API key

### "401 Unauthorized"

**Solution:** Your API key is invalid. Generate a new one

### "429 Too Many Requests"

**Solution:** You hit rate limits. Wait or upgrade your OpenAI plan

### No response generated

**Solution:** Check:
- Server console for errors
- OpenAI API status
- Your API key has available credits
- Internet connection is working

## Next Steps

1. **Test thoroughly** with different proficiency levels
2. **Monitor costs** in OpenAI dashboard
3. **Adjust prompts** in `openai-chat.ts` if needed
4. **Add features:**
   - Streaming responses for real-time display
   - Voice input/output
   - Topic selection
   - Grammar explanations

## Documentation

For detailed information, see:
- `docs/OPENAI_INTEGRATION.md` - Complete documentation
- `server/src/lib/openai-chat.ts` - Code with comments

## Support

- **OpenAI Issues:** [help.openai.com](https://help.openai.com/)
- **Application Issues:** Check server logs and console

---

**Enjoy learning Italian with AI! 🇮🇹 🤖**

