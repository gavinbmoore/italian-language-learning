# Anki Flashcard System Implementation

## Overview
A simplified spaced repetition flashcard system has been implemented to help users learn Italian vocabulary from conversations. The system uses a 2-button interface (Easy/Again) for fast and intuitive reviews.

## Features Implemented

### 1. Database Schema (Migration Applied ✅)
- **File**: `server/drizzle/0003_add_srs_fields.sql`
- Added SRS fields to the `vocabulary` table:
  - `next_review_date` - When the card is next due for review
  - `ease_factor` - Anki ease factor (default 2.5)
  - `interval_days` - Current interval in days
  - `repetitions` - Number of successful repetitions
  - `last_reviewed` - Last review timestamp
  - `is_flashcard` - Boolean flag to mark words as flashcards
  - `example_sentence` - Context sentence from conversation
  - `translation` - English translation
- Created indexes for efficient queries

### 2. Backend Implementation

#### Spaced Repetition Algorithm
- **File**: `server/src/lib/spaced-repetition.ts`
- Implements a simplified 2-button spaced repetition system
- Quality scale:
  - 1: Again (didn't know it)
  - 5: Easy (knew it)
- Interval progression:
  - Again: Reset to 12 hours
  - Easy: 12 hours → 3 days → 7.5 days → 18.75 days (multiply by 2.5x)
- Key functions:
  - `calculateNextReview()` - Calculates next review date based on performance
  - `getCardsDueForReview()` - Returns cards due for review
  - `reviewCard()` - Updates card after review
  - `getFlashcardStats()` - Returns statistics (due count, total cards, etc.)

#### API Endpoints
- **File**: `server/src/api.ts`
- `GET /api/v1/protected/flashcards/due` - Get cards due for review
- `POST /api/v1/protected/flashcards/review` - Submit review quality for a card
- `GET /api/v1/protected/flashcards/stats` - Get flashcard statistics

#### Unknown Words Integration
- Updated `save-unknown` endpoint to automatically initialize SRS fields
- Words saved from conversations are automatically converted to flashcards
- Initial review scheduled for 12 hours from creation

### 3. Frontend Implementation

#### Flashcard Review Component
- **File**: `ui/src/components/flashcard-review.tsx`
- Beautiful card flip animation using CSS 3D transforms
- Shows Italian word on front
- Flips to reveal English translation and example sentence
- Four review buttons: Again, Hard, Good, Easy
- Progress indicator showing current card and total
- Completion celebration message

#### CSS Animations
- **File**: `ui/src/index.css`
- Added 3D flip animation styles
- Smooth card transitions

#### Auto-Popup on App Start
- **File**: `ui/src/App.tsx`
- Automatically checks for due cards when user logs in
- Shows flashcard modal if cards are due
- User can skip review session if desired
- Refreshes stats after completing reviews

#### API Integration
- **File**: `ui/src/lib/serverComm.ts`
- Added flashcard API functions:
  - `getDueFlashcards()`
  - `reviewFlashcard(cardId, quality)`
  - `getFlashcardStats()`

#### UI Badge Indicators
- **File**: `ui/src/components/navbar.tsx`
- Shows "Review Cards" button with due count badge when cards are due
- Positioned in the navbar for easy access

- **File**: `ui/src/components/appSidebar.tsx`
- Shows "Review Cards" menu item with due count badge in sidebar
- Only visible when cards are due

## How It Works

### Creating Flashcards
1. User has a conversation in Italian on the Comprehensible Input page
2. User clicks on unknown words during the conversation
3. User clicks "End Lesson" button
4. System fetches translations for all marked words
5. User reviews and confirms words to save
6. Words are saved to vocabulary table with `is_flashcard: true`
7. Initial review is scheduled for 12 hours from now

### Reviewing Flashcards
1. User opens the app
2. System automatically checks for due cards
3. If cards are due, flashcard review modal appears
4. User sees the Italian word
5. User clicks to flip and see the English translation + example
6. User rates their recall using 2 simple buttons:
   - Again: Didn't know it → Reset to 12 hours
   - Easy: Knew it → Progress to next interval (12h → 3d → 7.5d → 18.75d → etc.)
7. Process repeats until all due cards are reviewed
8. Completion message is shown

### Spaced Repetition Schedule
- **Again** (didn't know): Reset to 12 hours
- **Easy** (knew it):
  - First review: 12 hours
  - Second review: 3 days
  - Third review: 7.5 days (3 × 2.5)
  - Fourth review: 18.75 days (7.5 × 2.5)
  - Continues multiplying by 2.5x each time

## Files Created

1. `server/drizzle/0003_add_srs_fields.sql` - Database migration
2. `server/src/lib/spaced-repetition.ts` - SRS algorithm implementation
3. `ui/src/components/flashcard-review.tsx` - Flashcard review component

## Files Modified

1. `server/src/schema/comprehensible-input.ts` - Added SRS field types
2. `server/src/api.ts` - Added flashcard endpoints and updated save-unknown
3. `ui/src/lib/serverComm.ts` - Added flashcard API functions
4. `ui/src/App.tsx` - Added auto-popup logic and flashcard state
5. `ui/src/components/navbar.tsx` - Added flashcard badge
6. `ui/src/components/appSidebar.tsx` - Added flashcard menu item
7. `ui/src/index.css` - Added 3D flip animation styles

## Testing the Implementation

1. Start the app
2. Go to Comprehensible Input page
3. Have a conversation in Italian
4. Click on several words you don't know
5. Click "End Lesson" button
6. Review the translations in the modal
7. Click "Save Words to Vocabulary"
8. Restart the app (or wait until tomorrow)
9. Flashcard review modal should appear automatically
10. Review the cards and rate your recall
11. Check the badge in navbar/sidebar for remaining due cards

## Future Enhancements

- Add daily/weekly statistics dashboard
- Allow manual addition of flashcards
- Support for audio pronunciation
- Option to edit flashcards
- Export/import flashcard decks
- Support for images on flashcards
- Study mode (review X cards per day limit)
- Heatmap calendar showing review activity

