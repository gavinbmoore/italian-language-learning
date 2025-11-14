/**
 * YouTube Video Search Integration
 * Uses YouTube Data API v3 to search for Italian grammar tutorial videos
 */

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  channelName: string;
  channelId: string;
  publishedAt: string;
  duration?: string;
  viewCount?: string;
}

export interface YouTubeSearchOptions {
  maxResults?: number;
  order?: 'relevance' | 'viewCount' | 'rating' | 'date';
  videoDuration?: 'short' | 'medium' | 'long' | 'any';
  language?: string;
}

/**
 * Search YouTube for Italian grammar tutorial videos
 */
export async function searchYouTubeVideos(
  conceptName: string,
  conceptNameItalian: string,
  options: YouTubeSearchOptions = {}
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not configured. YouTube video search will not work.');
    return [];
  }

  const {
    maxResults = 5,
    order = 'relevance',
    videoDuration = 'medium', // 4-20 minutes is usually ideal for tutorials
    language = 'it'
  } = options;

  try {
    // Build search query - combine English and Italian terms for best results
    const searchQuery = `${conceptName} ${conceptNameItalian} Italian grammar tutorial lesson`;
    
    // YouTube Data API v3 - Search endpoint
    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      type: 'video',
      maxResults: String(maxResults),
      order: order,
      videoDuration: videoDuration,
      relevanceLanguage: language,
      safeSearch: 'strict',
      videoEmbeddable: 'true', // Only return embeddable videos
      key: apiKey,
    });

    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams}`
    );

    if (!searchResponse.ok) {
      const error: any = await searchResponse.json();
      console.error('YouTube API search error:', error);
      throw new Error(`YouTube API error: ${error.error?.message || 'Unknown error'}`);
    }

    const searchData: any = await searchResponse.json();
    const videoIds = searchData.items?.map((item: any) => item.id.videoId).filter(Boolean) || [];

    if (videoIds.length === 0) {
      return [];
    }

    // Get video details (duration, view count, etc.)
    const detailsParams = new URLSearchParams({
      part: 'contentDetails,statistics',
      id: videoIds.join(','),
      key: apiKey,
    });

    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`
    );

    if (!detailsResponse.ok) {
      console.error('YouTube API details error');
      // Continue without details if this fails
    }

    const detailsData: any = detailsResponse.ok ? await detailsResponse.json() : null;
    const videoDetailsMap = new Map(
      detailsData?.items?.map((item: any) => [
        item.id,
        {
          duration: item.contentDetails?.duration || '',
          viewCount: item.statistics?.viewCount || '',
        }
      ]) || []
    );

    // Transform results
    const videos: YouTubeVideo[] = searchData.items.map((item: any) => {
      const videoId = item.id.videoId;
      const details = videoDetailsMap.get(videoId);
      
      return {
        videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || 
                   item.snippet.thumbnails?.medium?.url || 
                   item.snippet.thumbnails?.default?.url,
        channelName: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        duration: details?.duration ? formatDuration(details.duration) : undefined,
        viewCount: details?.viewCount ? formatViewCount(details.viewCount) : undefined,
      };
    });

    return videos;
  } catch (error) {
    console.error('Error searching YouTube videos:', error);
    throw error;
  }
}

/**
 * Convert ISO 8601 duration (PT15M33S) to readable format (15:33)
 */
function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}

/**
 * Format view count to readable format (1234567 -> 1.2M)
 */
function formatViewCount(count: string): string {
  const num = parseInt(count);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return String(num);
}
