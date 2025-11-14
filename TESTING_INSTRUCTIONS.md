# Testing the "Mark as Watched" Button

## I've Added Debugging

I just added debug output to help us understand what's happening. The UI server has been restarted with the changes.

## Steps to Test:

### 1. Refresh Your Browser
**IMPORTANT**: Hard refresh to clear cache
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + F5`

### 2. Open Browser Console
- Press `F12` or `Cmd + Option + I` (Mac)
- Click on the **Console** tab
- Keep it open so you can see log messages

### 3. Navigate to Grammar
- Go to `http://localhost:5173`
- Click "Grammar" in navigation

### 4. Select ANY Grammar Concept
- Click on any concept card
- Modal opens with concept details

### 5. Click on a Video
- Scroll down to "Video Tutorials" section
- Click on any video thumbnail
- Video player should expand

### 6. Look Below the Video Player

You should see ONE of these two things:

**Option A**: `[Mark as Watched]` button
- ✅ This means the video is NOT watched yet
- ✅ This is what we want to see!
- Click it to test marking as watched

**Option B**: Text saying "Debug: videoWatched is true"
- ⚠️ This means the video is already marked as watched
- This is why you don't see the button

### 7. Check the Console

Look for this message:
```
Video watched status: <videoId> true/false
```

This tells us if the API thinks the video is watched or not.

## What Each Scenario Means:

### Scenario 1: You See "Debug: videoWatched is true"
**Cause**: The video is already marked as watched in the database

**Solution**: Test with a different video that hasn't been watched yet, OR clear the database record:

```bash
# Clear ALL watch records (start fresh)
cd learning-app/server
psql postgresql://postgres:password@localhost:5502/postgres -c "DELETE FROM app.watched_grammar_videos;"
```

Then refresh the page and try again.

### Scenario 2: You See the "Mark as Watched" Button
**Perfect!** This is what we want. Now:
1. Click the button
2. It should change to "Marking..."
3. After ~1 second, the button disappears
4. You should see "Debug: videoWatched is true" appear
5. The "✓ Watched" badge appears above
6. A "Lesson Summary" section appears below

### Scenario 3: You Don't See Either
**Issue**: The code might not have loaded correctly

**Solution**:
1. Check browser console for errors
2. Make sure you hard-refreshed (Cmd+Shift+R)
3. Verify the UI server is running on port 5173

## Quick Test Commands

### Check what's in the database:
```bash
cd learning-app/server
psql postgresql://postgres:password@localhost:5502/postgres -c "SELECT video_id, video_title, watched_at FROM app.watched_grammar_videos ORDER BY watched_at DESC LIMIT 5;"
```

### Clear all watch records (fresh start):
```bash
cd learning-app/server
psql postgresql://postgres:password@localhost:5502/postgres -c "DELETE FROM app.watched_grammar_videos;"
```

### Test specific video status:
```bash
# Replace VIDEO_ID with actual YouTube video ID from the page
curl "http://localhost:8787/api/v1/protected/grammar/videos/VIDEO_ID/watched-status"
```

## What to Report Back

Please tell me:

1. **What do you see below the video?**
   - [ ] "Mark as Watched" button
   - [ ] "Debug: videoWatched is true" text
   - [ ] Nothing at all
   - [ ] Something else: ___________

2. **What's in the browser console?**
   - Copy/paste the "Video watched status" message
   - Any errors (red text)?

3. **Which video are you testing with?**
   - Which grammar concept?
   - Which video (title or thumbnail)?

This will help me understand exactly what's happening!

## Expected Full Flow

When everything works correctly:

1. Open video → See "Mark as Watched" button
2. Click button → Changes to "Marking..."
3. After ~1 second → Button disappears, "Debug" text appears
4. "✓ Watched" badge appears above video title
5. "Lesson Summary" section appears below with "Analyzing video..."
6. After 5-30 seconds → Analysis appears with lessons, examples, takeaways

---

**Note**: The debug message "Debug: videoWatched is true" is temporary - I added it to help us troubleshoot. Once we confirm everything works, I'll remove it and only show the "✓ Watched" badge.
