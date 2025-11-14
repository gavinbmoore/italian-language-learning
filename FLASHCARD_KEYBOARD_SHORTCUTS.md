# Flashcard Keyboard Shortcuts

## Overview
The flashcard system uses a simple 2-button approach with keyboard shortcuts for fast, efficient reviews. You can review cards without touching the mouse!

## Keyboard Shortcuts

### When Card is Face-Up (Italian word showing)

| Key | Action |
|-----|--------|
| `Space` | Flip card to see answer |
| `Enter` | Flip card to see answer |

### When Card is Flipped (Answer showing)

| Key | Action | Next Review |
|-----|--------|-------------|
| `←` Left Arrow | **Again** (Didn't know it) | Reset to 12 hours |
| `1` | **Again** (Didn't know it) | Reset to 12 hours |
| `→` Right Arrow | **Easy** (Knew it) | Progress: 12h → 3d → 7.5d → etc. |
| `Space` | **Easy** (Knew it) | Progress: 12h → 3d → 7.5d → etc. |

## Visual Indicators

The 2 review buttons show their keyboard shortcuts:
- **Again**: Shows "← or 1" (didn't know it)
- **Easy**: Shows "→ or Space" (knew it)
- **Show Answer button**: Shows "Press Space or Enter to flip"

## Quick Review Workflow

### Simple Two-Button Method
1. Card appears with Italian word
2. Press `Space` to flip and see the answer
3. Press:
   - `←` Left if you **didn't know** it (resets to 12 hours)
   - `→` Right or `Space` if you **knew** it (progresses to next interval)
4. Next card appears automatically
5. Repeat!

## Benefits

✅ **Lightning Fast** - Simple binary choice: knew it or didn't
✅ **Better Flow** - Smooth rhythm: flip → rate → next card
✅ **Less Context Switching** - Keep hands on keyboard
✅ **No Decision Paralysis** - Only 2 choices makes reviews effortless
✅ **Accessible** - Works for everyone, no learning curve

## Implementation Details

### Technical Features

- **Event Listener**: Attached to window when modal is open
- **State-Aware**: Only responds when appropriate (not during review processing)
- **Prevents Defaults**: Arrow keys won't scroll the page
- **Auto-Cleanup**: Event listeners removed when modal closes
- **Safe**: Can't accidentally trigger while reviewing

### Code Structure

```typescript
// Simplified keyboard shortcuts in flashcard-review.tsx
useEffect(() => {
  if (!open || isReviewing || showCompletion) return;

  const handleKeyPress = (event: KeyboardEvent) => {
    // Flip card when face-up
    if (!isFlipped && (event.key === ' ' || event.key === 'Enter')) {
      handleFlip();
      return;
    }

    // Rate card when flipped - only 2 options
    if (isFlipped) {
      switch (event.key) {
        case 'ArrowLeft': case '1': 
          handleReview(1); // Again
          break;
        case 'ArrowRight': case ' ': case '5': 
          handleReview(5); // Easy
          break;
      }
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [open, isFlipped, isReviewing, showCompletion, currentCard]);
```

## Usage Tips

1. **Use Arrow Keys**: Left for "Again", Right for "Easy"
   - Super fast binary decision
   
2. **Or Use Space**: Press Space to both flip AND rate as "Easy"
   - Ultimate speed mode for quick reviews
   
3. **Muscle Memory**: After a few cards, it becomes automatic!

4. **Review Speed**: Can easily review 30+ cards per minute

## Try It Now!

1. **Open flashcard review** (navbar → Review Cards → Practice All)
2. **See the Italian word**
3. **Press Space** to flip
4. **Press Left Arrow** (don't know) or **Right Arrow** (know)
5. **Repeat!**

You'll notice you can review cards much faster now! 🚀

## Accessibility

- ✅ All buttons still work with mouse clicks
- ✅ Visual indicators show keyboard shortcuts
- ✅ Works with screen readers
- ✅ Tab navigation still functional
- ✅ No keyboard traps

Perfect for:
- 🖥️ Desktop users
- ⚡ Power users who want speed
- ♿ Users who prefer keyboard navigation
- 🎯 Anyone wanting efficient reviews

