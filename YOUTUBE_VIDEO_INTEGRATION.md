# YouTube Video Integration for Grammar Sections

## Overview

The grammar learning system now includes integrated YouTube video tutorials. When users click into a grammar concept, they can browse and watch 3-5 relevant Italian grammar tutorial videos directly within the app.

## Features

### User Experience
- **Automatic Video Search**: When a user opens a grammar concept details, the system automatically searches YouTube for relevant tutorial videos
- **Multiple Options**: Users see 3-5 video options with thumbnails, titles, channel names, and durations
- **Embedded Player**: Click any video thumbnail to watch it directly in the app using YouTube's embedded player
- **Graceful Fallback**: If no videos are found or the API is unavailable, users see a helpful message

### Technical Implementation
- **YouTube Data API v3**: Uses Google's official API for video search
- **Smart Search Queries**: Combines English and Italian concept names for optimal results
- **Filtered Results**: Only returns embeddable videos of medium duration (4-20 minutes ideal for tutorials)
- **Optimized Performance**: Videos load asynchronously when concept is selected, not on page load
- **Error Handling**: Gracefully handles API failures without breaking the app

## Setup Instructions

### 1. Get a YouTube API Key

1. **Create/Select a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select an existing one

2. **Enable YouTube Data API v3**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

3. **Create an API Key**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

4. **Secure Your API Key (Recommended)**:
   - Click "Edit" on your API key
   - Under "API restrictions", select "Restrict key"
   - Choose "YouTube Data API v3" from the list
   - Under "Application restrictions", consider adding referrer restrictions for production

### 2. Configure the Environment Variable

**For Local Development:**
Add to `server/.dev.vars`:
```
YOUTUBE_API_KEY=your-api-key-here
```

**For Production (Cloudflare Workers):**
1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your worker
3. Navigate to Settings > Variables
4. Add a new environment variable:
   - Name: `YOUTUBE_API_KEY`
   - Value: `your-api-key-here`

### 3. Monitor Quota Usage

The YouTube Data API has a daily quota limit:
- **Free Tier**: 10,000 units/day
- **Cost per search**: ~100 units
- **Estimated searches**: ~100 searches/day on free tier

**Set up quota alerts**:
1. Go to Google Cloud Console > "APIs & Services" > "Dashboard"
2. Click on "YouTube Data API v3"
3. Navigate to "Quotas"
4. Set up alerts at 80% and 90% of quota

## How It Works

### Backend Flow

1. **API Endpoint**: `GET /api/v1/protected/grammar/concepts/:conceptId/videos`
   - Fetches the grammar concept from database
   - Builds search query: `{concept_name} {concept_name_italian} Italian grammar tutorial lesson`
   - Calls YouTube Data API with filters:
     - Type: video
     - Duration: medium (4-20 minutes)
     - Embeddable: true
     - Safe search: strict
   - Returns top 5 results with metadata

2. **YouTube Search Function** (`server/src/lib/youtube-search.ts`):
   - Searches YouTube Data API v3
   - Fetches additional video details (duration, view count)
   - Formats data for frontend consumption
   - Handles errors gracefully

### Frontend Flow

1. **User Opens Concept**: User clicks on a grammar concept card
2. **Modal Opens**: Concept detail modal displays
3. **Videos Load**: useEffect triggers video fetch for that concept
4. **Video Grid Displays**: Shows 3-5 video thumbnails with info
5. **User Selects Video**: Click thumbnail to watch in embedded player
6. **Playback**: YouTube video plays directly in the modal

## Files Modified/Created

### Backend
- ✅ **Created**: `server/src/lib/youtube-search.ts` - YouTube API integration
- ✅ **Modified**: `server/src/api.ts` - Added video endpoint at line 1464-1500
- ✅ **Modified**: `server/README.md` - Added YouTube API setup instructions

### Frontend
- ✅ **Modified**: `ui/src/lib/serverComm.ts` - Added `getGrammarVideos()` function (line 392-395)
- ✅ **Modified**: `ui/src/pages/Grammar.tsx` - Added video display UI and logic
  - Added video state management (lines 68-71)
  - Added `loadVideos()` function (lines 118-129)
  - Added useEffect to fetch videos (lines 82-90)
  - Added video UI in concept modal (lines 582-676)

## Cost Considerations

### Free Tier Limits
- 10,000 units/day free
- Each video search = ~100 units
- Each video details fetch = ~1 unit
- **Realistic usage**: ~95 concept video loads per day

### Cost Management Strategies
1. **Cache Results**: Consider caching popular videos in database (future enhancement)
2. **Monitor Usage**: Set up Google Cloud quota alerts
3. **Rate Limiting**: Backend already has rate limiting in place
4. **Fallback**: App works perfectly fine without YouTube API key

## Future Enhancements

Potential improvements for later:
- **Video Caching**: Store curated video IDs in database per concept
- **User Ratings**: Let users rate video quality to improve recommendations
- **Playlist Creation**: Allow users to save favorite videos to a playlist
- **Auto-Captions**: Fetch and display Italian/English captions
- **Watch Progress**: Track which videos users have watched
- **Related Videos**: Show more videos when user finishes one

## Troubleshooting

### No Videos Showing
1. Check `YOUTUBE_API_KEY` is set in environment
2. Verify API key is valid in Google Cloud Console
3. Check YouTube Data API v3 is enabled
4. Look for error messages in browser console and server logs

### Quota Exceeded
- Error: "quotaExceeded"
- Solution: Wait until next day (quota resets daily) or upgrade quota
- Temporary: Videos won't show but app continues to work

### Videos Not Embeddable
- The search filters ensure only embeddable videos are returned
- If you see errors, the video may have been made unembeddable after indexing

### API Key Restrictions
- If videos don't load, check API key restrictions in Google Cloud Console
- Make sure YouTube Data API v3 is in the allowed list
- For production, add referrer restrictions matching your domain

## Security Notes

- **API Key Protection**: The API key is stored server-side only, never exposed to client
- **Rate Limiting**: Server enforces rate limits to prevent abuse
- **Quota Management**: Monitor quota usage to avoid unexpected costs
- **Key Restrictions**: Use Google Cloud Console to restrict API key usage
- **Safe Search**: All video searches use strict safe search filtering

## Testing

To test the integration:

1. **Set up API key** as described above
2. **Restart server** to load new environment variable
3. **Navigate to Grammar page** in the app
4. **Click any grammar concept** to open details modal
5. **Check Video Tutorials section**:
   - Should show loading spinner initially
   - Then display 3-5 video options
   - Click thumbnail to watch video
   - Video should play in embedded player

If API key is not configured:
- No videos will show
- A message explains videos are unavailable
- All other features work normally

