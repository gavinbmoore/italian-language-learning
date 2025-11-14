/**
 * Video Analysis Library
 * Handles YouTube transcript extraction and AI-powered lesson analysis
 */

import { getDatabase } from './db';
import { eq, and } from 'drizzle-orm';
import { watchedGrammarVideos, grammarConcepts } from '../schema/grammar';
import type { VideoAnalysis, WatchedGrammarVideo } from '../schema/grammar';
import { getOpenAIClient } from './openai-chat';

/**
 * Extract YouTube video transcript
 * Uses youtube-transcript package to fetch captions
 */
export async function getYouTubeTranscript(videoId: string): Promise<{ text: string; language: string } | null> {
  try {
    // Dynamically import youtube-transcript
    const { YoutubeTranscript } = await import('youtube-transcript');
    
    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      console.warn(`No transcript found for video ${videoId}`);
      return null;
    }
    
    // Combine all transcript segments into full text
    const fullText = transcript.map((item: any) => item.text).join(' ');
    
    // Try to detect language (default to 'it' for Italian)
    const language = transcript[0]?.lang || 'it';
    
    return {
      text: fullText,
      language: language
    };
  } catch (error) {
    console.error(`Error fetching transcript for video ${videoId}:`, error);
    
    // If youtube-transcript fails, return null (graceful fallback)
    return null;
  }
}

/**
 * Analyze video transcript using OpenAI
 * Extracts core lessons, examples, and practice recommendations
 */
export async function analyzeVideoWithAI(
  transcript: string,
  conceptName: string,
  conceptNameItalian: string
): Promise<VideoAnalysis> {
  const openai = getOpenAIClient();
  
  const prompt = `You are an Italian language learning expert. Analyze the following video transcript about the grammar concept "${conceptName}" (${conceptNameItalian}).

Video Transcript:
${transcript.substring(0, 8000)} ${transcript.length > 8000 ? '...(truncated)' : ''}

Please extract and return a JSON object with the following structure:
{
  "coreLessons": ["lesson 1", "lesson 2", ...],  // 3-5 main grammar points/rules covered
  "examples": [
    {
      "italian": "example in Italian",
      "english": "English translation",
      "explanation": "brief explanation of the grammar point illustrated"
    }
  ],  // 3-5 clear examples from the video
  "keyTakeaways": ["takeaway 1", "takeaway 2", ...],  // 3-5 summary bullets
  "practiceRecommendations": ["recommendation 1", "recommendation 2", ...]  // 2-3 practice suggestions
}

Focus on:
1. Core grammar rules and patterns
2. Clear Italian-English example pairs that illustrate the concept
3. Common mistakes or important notes mentioned
4. Practical applications for learners

Return ONLY the JSON object, no additional text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Italian language teacher specializing in grammar instruction. You analyze video content and extract structured learning materials.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';
    
    // Parse JSON response
    const analysis: VideoAnalysis = JSON.parse(responseText);
    
    // Validate structure
    if (!analysis.coreLessons || !Array.isArray(analysis.coreLessons)) {
      analysis.coreLessons = [];
    }
    if (!analysis.examples || !Array.isArray(analysis.examples)) {
      analysis.examples = [];
    }
    if (!analysis.keyTakeaways || !Array.isArray(analysis.keyTakeaways)) {
      analysis.keyTakeaways = [];
    }
    if (!analysis.practiceRecommendations || !Array.isArray(analysis.practiceRecommendations)) {
      analysis.practiceRecommendations = [];
    }
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing video with AI:', error);
    
    // Return empty but valid analysis structure
    return {
      coreLessons: ['Unable to analyze video content. Please try again later.'],
      examples: [],
      keyTakeaways: [],
      practiceRecommendations: []
    };
  }
}

/**
 * Mark video as watched and optionally analyze it
 */
export async function markVideoAsWatched(
  userId: string,
  videoId: string,
  conceptId: string,
  videoTitle?: string,
  videoDuration?: string,
  analyzeNow: boolean = true
): Promise<string> {
  const db = await getDatabase();
  const id = `watched-video-${userId}-${videoId}-${Date.now()}`;
  
  try {
    // Check if already watched
    const existing = await db
      .select()
      .from(watchedGrammarVideos)
      .where(and(
        eq(watchedGrammarVideos.user_id, userId),
        eq(watchedGrammarVideos.video_id, videoId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      await db
        .update(watchedGrammarVideos)
        .set({
          watched_at: new Date(),
          watch_status: 'watched',
          updated_at: new Date(),
        })
        .where(eq(watchedGrammarVideos.id, existing[0].id));
      
      return existing[0].id;
    }
    
    // Create new watch record
    await db.insert(watchedGrammarVideos).values({
      id,
      user_id: userId,
      video_id: videoId,
      concept_id: conceptId,
      watched_at: new Date(),
      watch_status: 'watched',
      video_title: videoTitle,
      video_duration: videoDuration,
      created_at: new Date(),
      updated_at: new Date(),
    });
    
    // If analyzeNow is true, fetch and analyze transcript asynchronously
    if (analyzeNow) {
      // Run async without blocking
      analyzeAndStoreVideo(id, videoId, conceptId).catch(err => {
        console.error('Background video analysis failed:', err);
      });
    }
    
    return id;
  } catch (error) {
    console.error('Error marking video as watched:', error);
    throw error;
  }
}

/**
 * Analyze video and store results (background task)
 */
async function analyzeAndStoreVideo(watchRecordId: string, videoId: string, conceptId: string): Promise<void> {
  const db = await getDatabase();
  
  try {
    // Get concept info
    const concepts = await db
      .select()
      .from(grammarConcepts)
      .where(eq(grammarConcepts.id, conceptId))
      .limit(1);
    
    if (concepts.length === 0) {
      console.warn(`Concept ${conceptId} not found`);
      return;
    }
    
    const concept = concepts[0];
    
    // Fetch transcript
    const transcriptData = await getYouTubeTranscript(videoId);
    
    if (!transcriptData) {
      console.warn(`No transcript available for video ${videoId}`);
      // Update record to indicate no transcript
      await db
        .update(watchedGrammarVideos)
        .set({
          transcript: null,
          transcript_language: null,
          updated_at: new Date(),
        })
        .where(eq(watchedGrammarVideos.id, watchRecordId));
      return;
    }
    
    // Analyze with AI
    const analysis = await analyzeVideoWithAI(
      transcriptData.text,
      concept.name,
      concept.name_italian
    );
    
    // Store results
    await db
      .update(watchedGrammarVideos)
      .set({
        transcript: transcriptData.text,
        transcript_language: transcriptData.language,
        analysis: analysis as any, // Store as JSONB
        updated_at: new Date(),
      })
      .where(eq(watchedGrammarVideos.id, watchRecordId));
    
    console.log(`Successfully analyzed video ${videoId}`);
  } catch (error) {
    console.error(`Error in analyzeAndStoreVideo for ${videoId}:`, error);
  }
}

/**
 * Get video analysis (from cache or generate new)
 */
export async function getVideoAnalysis(
  userId: string,
  videoId: string,
  conceptId?: string
): Promise<{ analysis: VideoAnalysis | null; transcript: string | null; watchRecord: WatchedGrammarVideo | null }> {
  const db = await getDatabase();
  
  try {
    // Check if we have cached analysis
    const records = await db
      .select()
      .from(watchedGrammarVideos)
      .where(and(
        eq(watchedGrammarVideos.user_id, userId),
        eq(watchedGrammarVideos.video_id, videoId)
      ))
      .limit(1);
    
    if (records.length > 0) {
      const record = records[0];
      return {
        analysis: record.analysis as VideoAnalysis | null,
        transcript: record.transcript,
        watchRecord: record
      };
    }
    
    // No existing record - return null
    return {
      analysis: null,
      transcript: null,
      watchRecord: null
    };
  } catch (error) {
    console.error('Error getting video analysis:', error);
    throw error;
  }
}

/**
 * Get all watched videos for a concept
 */
export async function getWatchedVideosForConcept(
  userId: string,
  conceptId: string
): Promise<WatchedGrammarVideo[]> {
  const db = await getDatabase();
  
  try {
    const videos = await db
      .select()
      .from(watchedGrammarVideos)
      .where(and(
        eq(watchedGrammarVideos.user_id, userId),
        eq(watchedGrammarVideos.concept_id, conceptId)
      ))
      .orderBy(watchedGrammarVideos.watched_at);
    
    return videos;
  } catch (error) {
    console.error('Error getting watched videos:', error);
    throw error;
  }
}

/**
 * Check if user has watched a specific video
 */
export async function hasWatchedVideo(
  userId: string,
  videoId: string
): Promise<boolean> {
  const db = await getDatabase();
  
  try {
    const records = await db
      .select()
      .from(watchedGrammarVideos)
      .where(and(
        eq(watchedGrammarVideos.user_id, userId),
        eq(watchedGrammarVideos.video_id, videoId)
      ))
      .limit(1);
    
    return records.length > 0;
  } catch (error) {
    console.error('Error checking watched status:', error);
    return false;
  }
}

/**
 * Trigger analysis for an already watched video
 */
export async function triggerVideoAnalysis(
  userId: string,
  videoId: string,
  conceptId: string
): Promise<void> {
  const db = await getDatabase();
  
  try {
    // Get existing watch record
    const records = await db
      .select()
      .from(watchedGrammarVideos)
      .where(and(
        eq(watchedGrammarVideos.user_id, userId),
        eq(watchedGrammarVideos.video_id, videoId)
      ))
      .limit(1);
    
    if (records.length === 0) {
      throw new Error('Video not marked as watched');
    }
    
    // Trigger analysis
    await analyzeAndStoreVideo(records[0].id, videoId, conceptId);
  } catch (error) {
    console.error('Error triggering video analysis:', error);
    throw error;
  }
}


