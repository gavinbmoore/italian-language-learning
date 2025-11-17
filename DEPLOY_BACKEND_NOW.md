# Deploy Backend in 5 Minutes

Your frontend is live but needs the backend API. Here's the fastest way to deploy it:

## Option 1: Render.com (Easiest - 5 minutes)

1. Go to https://render.com and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select repository: **`italian-language-learning`**
5. Configure:
   - **Name:** `italian-learning-api`
   - **Region:** Oregon (US West) or your preferred region
   - **Branch:** `main`
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `pnpm install`
   - **Start Command:** `pnpm run start`

6. **Environment Variables** - Click "Advanced" and add:
   ```
   DATABASE_URL
   postgresql://neondb_owner:npg_cu6OLeKdDxa3@ep-broad-rice-aeihe0lz.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require

   OPENAI_API_KEY
   (get from server/.dev.vars file)

   YOUTUBE_API_KEY
   (get from server/.dev.vars file)

   FIREBASE_PROJECT_ID
   demo-project

   NODE_ENV
   production

   PORT
   8080
   ```

7. Click **"Create Web Service"**

8. Wait 3-5 minutes for deployment

9. **Copy your backend URL** (will be like: `https://italian-learning-api.onrender.com`)

10. Update frontend:
    ```bash
    cd ui
    VITE_API_URL=https://italian-learning-api.onrender.com pnpm run build
    cd ..
    npx wrangler pages deploy ui/dist --project-name italian-learning-app --commit-dirty=true
    ```

Done! Your app will be fully functional!

---

## Option 2: Railway.app (Also Easy)

1. Go to https://railway.app and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `italian-language-learning` repository
4. Configure:
   - **Root Directory:** `server`
   - **Build Command:** `pnpm install`
   - **Start Command:** `pnpm run start`

5. Add environment variables (same as above)
6. Deploy and get your URL
7. Rebuild frontend with new API URL (step 10 above)

---

## Option 3: Fly.io (Requires Account Verification)

Your Fly.io account was flagged as high-risk. Visit:
**https://fly.io/high-risk-unlock**

Then run:
```bash
cd server
flyctl launch --now
# Set secrets:
flyctl secrets set DATABASE_URL="your-db-url"
flyctl secrets set OPENAI_API_KEY="your-key"
flyctl secrets set YOUTUBE_API_KEY="your-key"
```

---

## Quick Test

Once backend is deployed, test it:
```bash
curl https://your-backend-url/api/v1/health
```

Should return: `{"status":"healthy"}`

---

## Current Status

✅ Frontend: https://3aa6ddef.italian-learning-app.pages.dev (LIVE but needs API)
✅ Database: Fully deployed on Neon with all data
✅ Code: Pushed to GitHub
⏳ Backend: Needs 5-minute deployment (follow Option 1 above)

---

## Files Ready for Deployment

- ✅ `server/Dockerfile` - Created
- ✅ `server/fly.toml` - Created
- ✅ `server/package.json` - Updated with tsx in dependencies
- ✅ Database migrations - All applied
- ✅ Database seeds - All loaded

Everything is ready! Just follow Option 1 above and your app will be fully functional in 5 minutes!

