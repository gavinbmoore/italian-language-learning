# Anki Deck Import System - Complete Implementation Guide

## Overview

The Anki deck import system allows users to upload `.apkg` files from AnkiWeb or the Anki desktop app and study them in your learning platform. The system includes full support for:

- **Basic flashcards** (front/back)
- **Cloze deletions** (fill-in-the-blank style cards)
- **Media files** (images and audio)
- **Anki's SRS scheduling** (preserves learning progress from imported decks)
- **HTML formatting** (styled cards with rich content)

## How to Use

### 1. Importing a Deck

1. Navigate to **Anki Decks** from the sidebar
2. Click **Import Deck** button
3. Select an `.apkg` file from your computer
   - Download decks from [AnkiWeb](https://ankiweb.net/shared/decks)
   - Or export from Anki desktop app (File → Export Deck)
4. Optionally provide a custom name
5. Click **Import Deck** and wait for processing

The system will:
- Extract all cards, notes, and media from the deck
- Parse card templates and generate front/back content
- Store media files (images, audio) in the database
- Initialize SRS state for each card
- Preserve any existing scheduling data from Anki

### 2. Studying a Deck

1. From the **Anki Decks** page, click on any deck card
2. View deck statistics:
   - Total cards
   - Due for review
   - New cards
   - Learning/Mastered cards
3. Click **Start Studying** to begin a review session
4. Review cards with keyboard shortcuts or button clicks

### 3. Card Review Controls

**Keyboard Shortcuts:**
- `Space`, `Enter`, `↓`, `↑` - Flip card to show answer
- `←` or `1` - Again (didn't know it)
- `↓` or `2` - Good (for learning cards)
- `→`, `Space`, or `3` - Easy/Correct

**Learning Phase Cards** (new or relearning):
- **Again** - Reset card, review in 12 hours
- **Good** - Advance to next learning step
- **Easy** - Skip learning steps, mark as graduated

**Review Phase Cards** (graduated):
- **Again** - Forgot card, send back to learning
- **Correct** - Remembered card, increase interval

### 4. Managing Decks

- **Delete deck**: Click the trash icon on a deck card
- **View statistics**: Each deck card shows current progress
- **Last studied**: Tracks when you last studied each deck

## Technical Features

### Database Schema

Five new tables added:
- `anki_decks` - Deck metadata
- `anki_notes` - Note data (a note can generate multiple cards)
- `anki_cards` - Individual card data
- `anki_card_state` - Per-user SRS state for each card
- `anki_media` - Media files (images, audio)

### Card Types Supported

1. **Basic Cards**: Simple front/back flashcards
2. **Basic (Reverse)**: Reverse cards generated from notes
3. **Cloze Deletions**: Fill-in-the-blank style with `{{c1::answer}}` syntax

### Media Support

- **Images**: Displayed inline in cards
- **Audio**: Playable audio files with controls
- **HTML/CSS**: Styled cards with formatting

### SRS Algorithm

Reuses the existing spaced-repetition algorithm:
- Learning steps: 12 hours → 3 days
- Graduating interval: 7.5 days
- Ease factor: 2.5 default (adjusts based on performance)
- Intervals multiply by ease factor after graduation

### API Endpoints

- `POST /api/v1/protected/anki/import` - Import .apkg file
- `GET /api/v1/protected/anki/decks` - List all decks
- `GET /api/v1/protected/anki/decks/:id` - Get deck details
- `DELETE /api/v1/protected/anki/decks/:id` - Delete deck
- `GET /api/v1/protected/anki/decks/:id/study` - Get study cards
- `POST /api/v1/protected/anki/decks/:id/review` - Review a card
- `GET /api/v1/protected/anki/media/:mediaId` - Serve media file

## Implementation Details

### Backend Files Created

1. **Database Migration**: `server/drizzle/0016_add_anki_decks.sql`
   - Creates all necessary tables and indexes

2. **Anki Parser**: `server/src/lib/anki-parser.ts`
   - Parses .apkg files (ZIP format)
   - Extracts SQLite database
   - Parses Anki's schema (notes, cards, models)
   - Extracts media files
   - Renders card templates

3. **Import Logic**: `server/src/lib/anki-import.ts`
   - Orchestrates import process
   - Stores decks, notes, cards, media
   - Initializes SRS state
   - Converts Anki scheduling to our format

4. **Review Algorithm**: `server/src/lib/anki-deck-review.ts`
   - Gets due/new cards for study
   - Reviews cards and updates SRS state
   - Tracks deck statistics

5. **Schema Types**: `server/src/schema/anki.ts`
   - TypeScript types for all Anki tables

6. **API Routes**: Added to `server/src/api.ts`
   - All endpoints for deck management and study

### Frontend Files Created

1. **Deck Library Page**: `ui/src/pages/AnkiDecks.tsx`
   - Deck list with statistics
   - Import dialog with file upload
   - Deck management (delete)

2. **Study Page**: `ui/src/pages/AnkiDeckStudy.tsx`
   - Deck statistics view
   - Study session starter
   - Routes to review component

3. **Review Component**: `ui/src/components/anki-card-review.tsx`
   - Card flip animation
   - Review buttons (Again/Good/Easy)
   - Queue management for learning cards
   - Keyboard shortcuts
   - Progress tracking

4. **Card Renderer**: `ui/src/components/anki-card-content.tsx`
   - Renders HTML content safely (DOMPurify)
   - Displays images (proxied through API)
   - Plays audio files
   - Styles cloze deletions

5. **API Integration**: Updated `ui/src/lib/serverComm.ts`
   - All API functions for Anki features

6. **Routing**: Updated `ui/src/App.tsx`
   - `/anki-decks` - Deck library
   - `/anki-decks/:deckId/study` - Study specific deck

7. **Navigation**: Updated `ui/src/components/appSidebar.tsx`
   - Added "Anki Decks" navigation link

### Dependencies Installed

**Backend:**
- `adm-zip` - ZIP file extraction for .apkg files
- `better-sqlite3` - Reading Anki's SQLite database

**Frontend:**
- `dompurify` - HTML sanitization for card content

## Security Features

- **HTML Sanitization**: All card content is sanitized with DOMPurify
- **Authentication Required**: All endpoints require user authentication
- **User Isolation**: Users can only access their own decks
- **Media Access Control**: Media files served through authenticated endpoint

## Performance Considerations

- **Media Storage**: Currently stores media as base64 in PostgreSQL
  - Can be migrated to S3/file storage for better performance
- **Pagination**: Study sessions limited to reasonable card counts
- **Indexes**: Database indexes on common queries for efficiency

## Migration Instructions

To apply the database migration:

```bash
cd learning-app/server
# The migration file is ready in drizzle/0016_add_anki_decks.sql
# Apply it using your migration tool or manually
```

## Testing the Feature

1. **Download a test deck** from AnkiWeb:
   - Visit https://ankiweb.net/shared/decks
   - Search for any topic (e.g., "Italian vocabulary")
   - Download a `.apkg` file

2. **Import the deck**:
   - Open your app
   - Go to Anki Decks page
   - Click Import Deck
   - Select the downloaded .apkg file
   - Wait for import (may take a few seconds for large decks)

3. **Study the deck**:
   - Click on the imported deck
   - View statistics
   - Click "Start Studying"
   - Review cards using keyboard or mouse

4. **Test different card types**:
   - Basic cards: Simple front/back
   - Cloze deletions: Look for `[...]` blanks
   - Media: Decks with images or audio

## Troubleshooting

### Import fails
- Check file is valid .apkg format
- Check file size (very large decks may timeout)
- Check server logs for parsing errors

### Media not displaying
- Check browser console for 404 errors
- Verify media endpoint is accessible
- Check authentication token is valid

### Cards not scheduling correctly
- Verify migration was applied
- Check SRS state is being updated (database)
- Review server logs during card reviews

## Future Enhancements

Possible additions:
- CSV import support (simpler than .apkg)
- Deck export functionality
- File storage for media (S3, local filesystem)
- Deck sharing between users
- Custom card creation UI
- Mobile app support
- Statistics dashboard
- Study streaks and achievements

## Files Summary

### Backend (7 files)
- Migration: `drizzle/0016_add_anki_decks.sql`
- Parser: `lib/anki-parser.ts`
- Import: `lib/anki-import.ts`
- Review: `lib/anki-deck-review.ts`
- Schema: `schema/anki.ts`
- API: Updated `api.ts`

### Frontend (5 files)
- Pages: `pages/AnkiDecks.tsx`, `pages/AnkiDeckStudy.tsx`
- Components: `components/anki-card-review.tsx`, `components/anki-card-content.tsx`
- API: Updated `lib/serverComm.ts`
- Routing: Updated `App.tsx`, `appSidebar.tsx`

## Support

For issues or questions:
- Check server logs for errors
- Check browser console for frontend errors
- Review this guide for common solutions
- Test with simple decks first before complex ones

---

**Status**: ✅ Fully Implemented and Ready to Use

All features from the plan have been completed including:
- ✅ Database schema
- ✅ .apkg file parsing
- ✅ Import logic
- ✅ Review algorithm
- ✅ API endpoints
- ✅ Frontend pages and components
- ✅ Media rendering
- ✅ Routing and navigation

