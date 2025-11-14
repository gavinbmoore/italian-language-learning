# Flashcard Review Anytime Feature

## Overview
Extended the Anki flashcard system to allow users to review cards at any time, not just when they're due. Users can now practice their vocabulary whenever they want!

## New Features

### 1. Two Review Modes

#### **Review Due Cards** (Original)
- Only shows cards that are due for review based on the Anki algorithm
- Updates the spaced repetition schedule
- Ideal for maintaining long-term retention

#### **Practice All Cards** (New)
- Shows all flashcards regardless of due date
- Still updates the spaced repetition schedule when reviewed
- Perfect for extra practice or cramming before a conversation
- Limited to 20 cards per session (configurable)

### 2. Always-Available Review Button

The flashcard review button now:
- **Always visible** when you have any flashcards (not just when cards are due)
- Shows **dropdown menu** with two options:
  - "Review Due Cards" (with due count badge if cards are due)
  - "Practice All Cards (X)" showing total card count

### 3. Sidebar Integration

The sidebar now shows two separate menu items when flashcards exist:
- **"Review Due"** - Quick access to due cards with badge
- **"Practice All (X)"** - Review all cards with total count

## Implementation Details

### Backend Changes

**File: `server/src/lib/spaced-repetition.ts`**
- Added `getAllFlashcards(userId, limit)` function
- Returns all flashcards ordered by next_review_date
- Default limit of 20 cards per session

**File: `server/src/api.ts`**
- Added endpoint: `GET /api/v1/protected/flashcards/all?limit=20`
- Returns all flashcards for practice mode

### Frontend Changes

**File: `ui/src/lib/serverComm.ts`**
- Added `getAllFlashcards(limit)` API function

**File: `ui/src/App.tsx`**
- Updated `handleOpenFlashcards` to accept mode parameter: `'due' | 'all'`
- Fetches appropriate cards based on mode
- Shows alert if no cards available for selected mode

**File: `ui/src/components/navbar.tsx`**
- Changed button to dropdown menu with ChevronDown icon
- Two menu items: "Review Due Cards" and "Practice All Cards"
- Shows due count badge when cards are due
- Always visible when `flashcardTotalCount > 0`

**File: `ui/src/components/appSidebar.tsx`**
- Two separate menu items instead of one conditional item
- "Review Due" with due count badge
- "Practice All (X)" with total count
- Both always visible when flashcards exist

## How It Works

### User Flow

1. **Button Always Available**: Once you have flashcards, the "Review Cards" button/menu items are always visible

2. **Choose Review Mode**:
   - **Navbar**: Click dropdown → Select "Review Due Cards" or "Practice All Cards"
   - **Sidebar**: Click "Review Due" or "Practice All (X)"

3. **Review Session**: 
   - Cards appear in flashcard modal
   - Same review interface (flip card, rate difficulty)
   - Spaced repetition schedule updates based on your rating

4. **No Cards Available**:
   - "Review Due": Shows alert if no cards are due
   - "Practice All": Shows alert if no flashcards exist at all

### API Endpoints

```
GET /api/v1/protected/flashcards/due
→ Returns cards where next_review_date <= now

GET /api/v1/protected/flashcards/all?limit=20
→ Returns all flashcards ordered by next_review_date

POST /api/v1/protected/flashcards/review
→ Updates card's SRS parameters (works for both modes)

GET /api/v1/protected/flashcards/stats
→ Returns statistics (dueCount, totalCards, etc.)
```

## Testing

1. **Review button should always be visible** (when you have flashcards)
2. **Dropdown shows two options**:
   - Review Due Cards (with red badge if cards are due)
   - Practice All Cards (with total count)
3. **Click "Practice All"** → Should show all your flashcards
4. **Review cards** → Ratings update the schedule properly
5. **Sidebar shows both options** separately

## Current Test Data

You have **10 flashcards** in the system:
- **Due cards**: 1 (stancante)
- **Total cards**: 10
- Some cards have been reviewed (ciao, grazie, bello - repetitions=1)
- Some cards are new (qualcosa, comodo, linguaggio, etc.)

## Benefits

✅ **Practice anytime** - Don't wait for cards to be due
✅ **Pre-conversation prep** - Review words before speaking Italian
✅ **Reinforcement learning** - Extra practice when you have time
✅ **User control** - You decide when to review
✅ **Still maintains SRS** - All reviews update the schedule
✅ **Flexible limits** - Can adjust how many cards to practice

## Try It Now!

1. **Refresh your browser** to load the new code
2. Look for the **"Review Cards"** button in navbar (should show dropdown icon)
3. Click it and select **"Practice All Cards"**
4. Review as many cards as you want!
5. Close the modal anytime - you're in control!

The system will remember your reviews and adjust future due dates accordingly. Happy learning! 🎴✨

