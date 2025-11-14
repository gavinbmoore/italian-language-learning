# Anki Queue Fix - Testing Guide

## What Was Fixed

**Bug:** Cards marked "Again" were not reappearing in the review session because the frontend was checking `result.in_session` instead of `result.result.in_session`.

**Fix:** Corrected the property path to properly access the `in_session` flag from the API response.

## Testing Steps

### Prerequisites
- Have at least 5 flashcards ready for review (or use practice mode)
- Open browser Developer Console (F12) to see logging

### Test Scenario 1: Basic "Again" Behavior

1. **Start a flashcard review session**
   - Open the app
   - Click "Review Cards" or "Practice All Cards"

2. **Review the first card and click "Again"**
   - Look for this console message:
     ```
     🔄 Adding card to queue: { word: "...", currentIndex: 0, showAfter: 3, learning_step: 0 }
     ```
   - This confirms the card was added to the queue

3. **Review the next 3 cards** (click any button - Good/Easy)
   - After each card, check the console for:
     ```
     📋 Queue check: { currentIndex: X, queueLength: 1, nextQueuedCard: null }
     ```

4. **On the 4th card after "Again"**
   - You should see:
     ```
     📋 Queue check: { currentIndex: 3, queueLength: 1, nextQueuedCard: { word: "...", showAfter: 3 } }
     ✅ Showing queued card: { word: "...", wasScheduledFor: 3, nowAtIndex: 4 }
     ```
   - **The original card should reappear!** ✓

### Test Scenario 2: Multiple "Again" Clicks

1. **Start a review session**

2. **Click "Again" on the first TWO cards**
   - Both should be added to queue with different `showAfter` values
   - Check console for two "Adding card to queue" messages

3. **Continue reviewing**
   - After 3 cards, the first "Again" card should reappear
   - After 3 MORE cards, the second "Again" card should reappear

### Test Scenario 3: Learning Phase Progression

1. **Click "Again" on a card** → It goes to learning_step 0, stays in queue

2. **When it reappears, click "Good"** → It advances to learning_step 1, stays in queue
   - Check console: `learning_step: 1`

3. **When it reappears again, click "Good"** → It graduates (learning_step: -1), leaves session
   - Check console: Card should NOT be added to queue

4. **When it reappears again (if it was due), click "Easy"** → It graduates immediately
   - Should NOT be added to queue

## Expected Console Output Pattern

For a card marked "Again":
```
🔄 Adding card to queue: { word: "example", currentIndex: 0, showAfter: 3, learning_step: 0 }
📋 Queue check: { currentIndex: 0, queueLength: 1, nextQueuedCard: null }
📋 Queue check: { currentIndex: 1, queueLength: 1, nextQueuedCard: null }
📋 Queue check: { currentIndex: 2, queueLength: 1, nextQueuedCard: null }
📋 Queue check: { currentIndex: 3, queueLength: 1, nextQueuedCard: { word: "example", showAfter: 3 } }
✅ Showing queued card: { word: "example", wasScheduledFor: 3, nowAtIndex: 4 }
```

## What to Look For

✅ **Working Correctly:**
- Cards marked "Again" appear in console log with "Adding card to queue"
- After reviewing 3 cards, the queued card reappears
- The card you see matches the word in the console log

❌ **Still Broken:**
- No "Adding card to queue" message when clicking "Again"
- Queued cards never reappear
- Session ends without showing queued cards again

## Common Issues

### Issue: "queueLength: 0" even after "Again"
**Cause:** The API might not be returning `in_session: true`
**Check:** Look at the full API response in Network tab

### Issue: nextQueuedCard is always null
**Cause:** The `showAfter` calculation might be wrong
**Check:** Verify `showAfter` is being set correctly in console

## After Testing

Once you've confirmed the fix is working:
1. Report results
2. We'll remove the console.log statements (they're temporary for debugging)
3. The Anki algorithm will be fully functional!

