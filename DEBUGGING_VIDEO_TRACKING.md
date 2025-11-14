# Debugging Video Tracking Feature - Step by Step

## Server Status: ✅ Both Running

- Backend: `http://localhost:8787` ✅
- Frontend: `http://localhost:5173` ✅

## Step-by-Step Testing Guide

### Step 1: Open the App
1. Open your browser (Chrome recommended for DevTools)
2. Navigate to `http://localhost:5173`
3. Open Browser DevTools (Press F12 or Cmd+Option+I on Mac)
4. Go to the **Console** tab

**Expected**: App loads, no errors in console

### Step 2: Navigate to Grammar Section
1. Click on "Grammar" in the navigation menu
2. Check console for any errors

**Expected**: Grammar page loads with concept cards

### Step 3: Select a Grammar Concept
1. Click on ANY grammar concept card (e.g., "Present Tense - Essere")
2. A modal should open with concept details
3. Check console for errors

**Expected**: Modal opens showing concept details

### Step 4: Check for Videos
Look in the modal for "Video Tutorials" section

**Question**: Do you see videos loading?

- **If YES** → Continue to Step 5
- **If NO** → See "Troubleshooting: No Videos" below

### Step 5: Click on a Video
1. Click on any video thumbnail
2. The video should expand to full size with YouTube iframe player

**Expected**: Video player appears

### Step 6: Look for "Mark as Watched" Button
Look below the video player

**Question**: Do you see the "Mark as Watched" button?

- **If YES** → Continue to Step 7
- **If NO** → Check if you see "✓ Watched" badge (means it's already marked)
- **If NEITHER** → The UI changes didn't load correctly

### Step 7: Click "Mark as Watched"
1. Click the "Mark as Watched" button
2. Watch the Console tab for network requests
3. Switch to the **Network** tab in DevTools
4. Look for a POST request to `/mark-watched`

**Expected**:
- Button text changes to "Marking..."
- Network request shows in DevTools
- After success, button disappears
- "✓ Watched" badge appears

### Step 8: Check for Lesson Summary
After marking as watched, look for "Lesson Summary" section

**Expected**:
- New section appears with "Analyzing video..." message
- After 5-30 seconds, analysis appears with lessons/examples

## Troubleshooting

### Issue: No Videos Showing

**Check 1**: Is YouTube API key set?
```bash
cd learning-app/server
cat .env | grep YOUTUBE_API_KEY
```

**Solution**: If missing, add to `.env`:
```
YOUTUBE_API_KEY=your_key_here
```

**Check 2**: Network request
- In DevTools Network tab, look for request to `/videos`
- Check the response - does it have videos?

### Issue: "Mark as Watched" Button Not Visible

**Check 1**: Is the code loaded?
- Open DevTools Console
- Type: `console.log("Check")` and press Enter
- Refresh the page (Cmd+R or Ctrl+R)
- Look for the app to reload

**Check 2**: Check if video state exists
- Open Console tab
- When video is playing, type:
```javascript
// This won't work directly but shows what to check
// Look for React DevTools instead
```

**Check 3**: React DevTools
- Install React DevTools extension if you don't have it
- Open React DevTools
- Find the `Grammar` component
- Look for `selectedVideo` state - should have video data

### Issue: Button Doesn't Do Anything When Clicked

**Check 1**: Console Errors
- Look in Console tab for red error messages
- Common errors:
  - "Failed to fetch" → Backend not running
  - "404 Not Found" → Wrong API endpoint
  - CORS error → Port mismatch

**Check 2**: Network Request
- Go to Network tab in DevTools
- Click "Mark as Watched"
- Look for the request
- Check its status:
  - ✅ 200 = Success
  - ❌ 404 = Endpoint not found
  - ❌ 500 = Server error

**Check 3**: Test API directly
```bash
# Test the endpoint directly
curl -X POST "http://localhost:8787/api/v1/protected/grammar/videos/TEST123/mark-watched" \
  -H "Content-Type: application/json" \
  -d '{"conceptId": "a1-definite-articles", "videoTitle": "Test", "videoDuration": "5:00"}'
```

Expected output:
```json
{"success":true,"watchRecordId":"...","message":"Video marked as watched..."}
```

### Issue: No Lesson Summary Appears

**Check 1**: Is video actually watched?
```bash
# Check if video was marked
curl "http://localhost:8787/api/v1/protected/grammar/videos/ACTUAL_VIDEO_ID/watched-status"
```

Expected: `{"watched":true}`

**Check 2**: Check if analysis is being generated
```bash
# Replace ACTUAL_VIDEO_ID with real video ID
curl "http://localhost:8787/api/v1/protected/grammar/videos/ACTUAL_VIDEO_ID/analysis"
```

Look for:
- `"transcript": null` → Video has no captions
- `"transcript": "..."` → Has transcript, analysis should generate
- `"analysis": {...}` → Analysis complete

**Check 3**: Wait longer
- Some videos take 30-60 seconds to analyze
- Check server terminal for processing logs

**Check 4**: Video must have captions
- Not all YouTube videos have captions
- Try a different video
- Look for [CC] icon on YouTube player

### Issue: Analysis Says "Analyzing..." Forever

**Possible Causes**:

1. **Video has no transcript**
   - Solution: Try a different video that has captions

2. **OpenAI API key missing**
   ```bash
   cd learning-app/server
   cat .env | grep OPENAI_API_KEY
   ```
   - Solution: Add valid OpenAI API key

3. **Server error**
   - Check server terminal output for errors
   - Look for "Error analyzing video" messages

4. **API rate limit**
   - OpenAI has rate limits
   - Wait a few minutes and try again

## Manual Test Commands

### Test 1: Mark a specific video as watched
```bash
curl -X POST "http://localhost:8787/api/v1/protected/grammar/videos/dQw4w9WgXcQ/mark-watched" \
  -H "Content-Type: application/json" \
  -d '{
    "conceptId": "a1-present-tense-essere",
    "videoTitle": "Test Video",
    "videoDuration": "3:45"
  }'
```

### Test 2: Check if it was marked
```bash
curl "http://localhost:8787/api/v1/protected/grammar/videos/dQw4w9WgXcQ/watched-status"
```

### Test 3: Get the analysis
```bash
curl "http://localhost:8787/api/v1/protected/grammar/videos/dQw4w9WgXcQ/analysis?conceptId=a1-present-tense-essere"
```

### Test 4: Check database directly
```bash
cd learning-app/server
node -e "
const postgres = require('postgres');
const sql = postgres('postgresql://postgres:password@localhost:5502/postgres');
sql\`SELECT * FROM app.watched_grammar_videos LIMIT 5\`
  .then(rows => console.log(JSON.stringify(rows, null, 2)))
  .finally(() => sql.end());
"
```

## What to Report Back

If it's still not working, please provide:

1. **What step fails?** (Step number from above)

2. **Console errors?** (Screenshot or copy/paste from Console tab)

3. **Network request details?** (From Network tab):
   - Request URL
   - Status code
   - Response body

4. **Server logs?** (From the terminal running `pnpm dev` in server folder)

5. **Specific issue**:
   - [ ] Videos don't show at all
   - [ ] "Mark as Watched" button missing
   - [ ] Button doesn't respond to clicks
   - [ ] No lesson summary appears
   - [ ] Analysis never completes
   - [ ] Other: ___________

## Quick Verification Checklist

Run these commands to verify everything:

```bash
# 1. Check backend is running
curl -s http://localhost:8787/api/v1/protected/grammar/concepts | head -c 100

# 2. Check UI is running  
curl -s http://localhost:5173 | head -c 100

# 3. Check if watched_grammar_videos table exists
cd learning-app/server
psql postgresql://postgres:password@localhost:5502/postgres -c "\dt app.watched_grammar_videos"

# 4. Check OpenAI key is set
grep OPENAI_API_KEY .env

# 5. Test marking watched
curl -X POST "http://localhost:8787/api/v1/protected/grammar/videos/TEST/mark-watched" \
  -H "Content-Type: application/json" \
  -d '{"conceptId": "a1-definite-articles"}'
```

All 5 should succeed with no errors.

