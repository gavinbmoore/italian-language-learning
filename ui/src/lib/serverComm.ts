import { getAuth } from 'firebase/auth';
import { app } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// Functional error type instead of class
interface APIError extends Error {
  status: number;
  code?: string;
  user_id?: string;
}

function createAPIError(status: number, message: string, code?: string, user_id?: string): APIError {
  const error = new Error(message) as APIError;
  error.name = 'APIError';
  error.status = status;
  error.code = code;
  error.user_id = user_id;
  return error;
}

async function getAuthToken(): Promise<string | null> {
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    
    throw createAPIError(
      response.status,
      errorData.error || errorData.message || `API request failed: ${response.statusText}`,
      errorData.code,
      errorData.user_id
    );
  }

  return response;
}

// API endpoints
export async function getCurrentUser(): Promise<{
  user: {
    id: string;
    email: string | null;
    display_name: string | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
  };
  message: string;
}> {
  const response = await fetchWithAuth('/api/v1/protected/me');
  return response.json();
}

// Comprehensible Input (i+1) API endpoints
export async function getProficiency() {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/proficiency');
  return response.json();
}

export async function analyzeText(text: string) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  return response.json();
}

export async function sendMessage(message: string) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/conversation/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  return response.json();
}

export async function generateAIResponse(userMessage: string, sessionId?: string) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/conversation/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userMessage, sessionId }),
  });
  return response.json();
}

export async function saveAssistantResponse(userMessage: string, assistantResponse: string) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/conversation/response', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userMessage, assistantResponse }),
  });
  return response.json();
}

export async function markWordsAsKnown(words: string[]) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/vocabulary/mark-known', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ words }),
  });
  return response.json();
}

export async function getConversationHistory(limit: number = 50, offset: number = 0) {
  const response = await fetchWithAuth(
    `/api/v1/protected/comprehensible-input/conversation/history?limit=${limit}&offset=${offset}`
  );
  return response.json();
}

export async function getVocabulary(known?: boolean, limit: number = 100, offset: number = 0) {
  const knownParam = known !== undefined ? (known ? 'true' : 'false') : undefined;
  const url = `/api/v1/protected/comprehensible-input/vocabulary?limit=${limit}&offset=${offset}${
    knownParam ? `&known=${knownParam}` : ''
  }`;
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function translateWords(words: string[]) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/vocabulary/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ words }),
  });
  const data = await response.json();
  return data.translations || [];
}

export async function saveUnknownWords(words: Array<{ word: string; sentence: string; translation?: string }>, sessionId?: string) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/vocabulary/save-unknown', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ words, sessionId }),
  });
  return response.json();
}

// Conversation Session API endpoints
export async function getRecentSessions(limit: number = 5) {
  const response = await fetchWithAuth(
    `/api/v1/protected/comprehensible-input/sessions/recent?limit=${limit}`
  );
  return response.json();
}

export async function getSessionMessages(sessionId: string) {
  const response = await fetchWithAuth(
    `/api/v1/protected/comprehensible-input/sessions/${sessionId}/messages`
  );
  return response.json();
}

export async function endCurrentSession(sessionId: string) {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/sessions/end', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });
  return response.json();
}

// Learning Timer API endpoints
export async function startLearningSession(pageContext: string = 'general') {
  const response = await fetchWithAuth('/api/v1/protected/learning-timer/session/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageContext }),
  });
  return response.json();
}

export async function updateLearningSession(sessionId: string, durationSeconds: number) {
  const response = await fetchWithAuth('/api/v1/protected/learning-timer/session/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, durationSeconds }),
  });
  return response.json();
}

export async function endLearningSession(sessionId: string) {
  const response = await fetchWithAuth('/api/v1/protected/learning-timer/session/end', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });
  return response.json();
}

export async function getActiveSession() {
  const response = await fetchWithAuth('/api/v1/protected/learning-timer/session/active');
  return response.json();
}

export async function getTotalLearningTime(days?: number) {
  const url = days 
    ? `/api/v1/protected/learning-timer/time/total?days=${days}`
    : '/api/v1/protected/learning-timer/time/total';
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function getLearningStats() {
  const response = await fetchWithAuth('/api/v1/protected/learning-timer/stats');
  return response.json();
}

export async function getLearningSessionHistory(limit: number = 50, offset: number = 0) {
  const response = await fetchWithAuth(
    `/api/v1/protected/learning-timer/sessions?limit=${limit}&offset=${offset}`
  );
  return response.json();
}

export async function getActivityData(startDate: string, endDate: string) {
  const response = await fetchWithAuth(
    `/api/v1/protected/learning-timer/activity?startDate=${startDate}&endDate=${endDate}`
  );
  return response.json();
}

// Conversation Memory API endpoints
export async function generateMemories() {
  const response = await fetchWithAuth('/api/v1/protected/comprehensible-input/memory/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}

export async function getConversationMemories(limit: number = 50) {
  const response = await fetchWithAuth(
    `/api/v1/protected/comprehensible-input/memory?limit=${limit}`
  );
  return response.json();
}

export async function deleteConversationMemory(memoryId: string) {
  const response = await fetchWithAuth(
    `/api/v1/protected/comprehensible-input/memory/${memoryId}`,
    {
      method: 'DELETE',
    }
  );
  return response.json();
}

export async function getLastSessionSummary() {
  const response = await fetchWithAuth(
    `/api/v1/protected/comprehensible-input/memory/last-session-summary`
  );
  return response.json();
}

// Flashcard / SRS API endpoints
export async function getDueFlashcards() {
  const response = await fetchWithAuth('/api/v1/protected/flashcards/due');
  return response.json();
}

export async function getAllFlashcards(limit: number = 20) {
  const response = await fetchWithAuth(`/api/v1/protected/flashcards/all?limit=${limit}`);
  return response.json();
}

export async function getHardFlashcards(limit: number = 20) {
  const response = await fetchWithAuth(`/api/v1/protected/flashcards/hard?limit=${limit}`);
  return response.json();
}

export async function reviewFlashcard(cardId: string, quality: number) {
  const response = await fetchWithAuth('/api/v1/protected/flashcards/review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cardId, quality }),
  });
  return response.json();
}

export async function getFlashcardStats() {
  const response = await fetchWithAuth('/api/v1/protected/flashcards/stats');
  return response.json();
}

export async function getLearnedWordsStats() {
  const response = await fetchWithAuth('/api/v1/protected/flashcards/learned-stats');
  return response.json();
}

export const api = {
  getCurrentUser,
  // Comprehensible Input endpoints
  getProficiency,
  analyzeText,
  sendMessage,
  generateAIResponse,
  saveAssistantResponse,
  markWordsAsKnown,
  getConversationHistory,
  getVocabulary,
  translateWords,
  saveUnknownWords,
  // Session endpoints
  getRecentSessions,
  getSessionMessages,
  endCurrentSession,
  // Memory endpoints
  generateMemories,
  getConversationMemories,
  deleteConversationMemory,
  getLastSessionSummary,
  // Learning Timer endpoints
  startLearningSession,
  updateLearningSession,
  endLearningSession,
  getActiveSession,
  getTotalLearningTime,
  getLearningStats,
  getLearningSessionHistory,
  getActivityData,
  // Flashcard endpoints
  getDueFlashcards,
  getAllFlashcards,
  getHardFlashcards,
  reviewFlashcard,
  getFlashcardStats,
  getLearnedWordsStats,
  // Grammar endpoints
  getGrammarConcepts: async (level?: string, category?: string) => {
    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (category) params.append('category', category);
    const query = params.toString();
    const response = await fetchWithAuth(`/api/v1/protected/grammar/concepts${query ? `?${query}` : ''}`);
    return response.json();
  },
  getGrammarConcept: async (conceptId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/grammar/concepts/${conceptId}`);
    return response.json();
  },
  getGrammarLearningPath: async () => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/learning-path');
    return response.json();
  },
  getGrammarVideos: async (conceptId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/grammar/concepts/${conceptId}/videos`);
    return response.json();
  },
  getWeakGrammarAreas: async (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetchWithAuth(`/api/v1/protected/grammar/weak-areas${query}`);
    return response.json();
  },
  getGrammarErrors: async (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetchWithAuth(`/api/v1/protected/grammar/errors${query}`);
    return response.json();
  },
  getGrammarStats: async () => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/stats');
    return response.json();
  },
  generateGrammarExercises: async (conceptId: string, count?: number) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/exercises/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId, count }),
    });
    return response.json();
  },
  submitGrammarExercise: async (exerciseId: string, userAnswer: string, timeSpentSeconds?: number) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/exercises/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId, userAnswer, timeSpentSeconds }),
    });
    return response.json();
  },
  // Adaptive practice session methods
  startPracticeSession: async (conceptId: string) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/practice-session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId }),
    });
    return response.json();
  },
  getNextBatch: async (sessionId: string) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/practice-session/next-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return response.json();
  },
  completePracticeSession: async (sessionId: string) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/practice-session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return response.json();
  },
  getRecentPracticeSessions: async (conceptId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/grammar/practice-session/recent/${conceptId}`);
    return response.json();
  },
  // Conversational grammar tutor methods
  startGrammarConversation: async (conceptId: string) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/conversation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId }),
    });
    return response.json();
  },
  continueGrammarConversation: async (conceptId: string, sessionId: string, message: string, context: any) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/conversation/continue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId, sessionId, message, context }),
    });
    return response.json();
  },
  endGrammarConversation: async (conceptId: string, sessionId: string, context: any, userDifficultyRating?: 'easy' | 'medium' | 'difficult') => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/conversation/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId, sessionId, context, userDifficultyRating }),
    });
    return response.json();
  },
  getPersonalizedGrammarDrill: async (count?: number) => {
    const query = count ? `?count=${count}` : '';
    const response = await fetchWithAuth(`/api/v1/protected/grammar/exercises/personalized${query}`);
    return response.json();
  },
  getGrammarExerciseHistory: async (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetchWithAuth(`/api/v1/protected/grammar/exercises/history${query}`);
    return response.json();
  },
  getGrammarExerciseStats: async () => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/exercises/stats');
    return response.json();
  },
  getDueGrammarConcepts: async () => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/review/due');
    return response.json();
  },
  reviewGrammarConcept: async (conceptId: string, quality: number) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId, quality }),
    });
    return response.json();
  },
  initializeGrammarConcept: async (conceptId: string) => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/review/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId }),
    });
    return response.json();
  },
  getGrammarMasteryStats: async () => {
    const response = await fetchWithAuth('/api/v1/protected/grammar/mastery/stats');
    return response.json();
  },
  // Video tracking endpoints
  markGrammarVideoWatched: async (videoId: string, conceptId: string, videoTitle?: string, videoDuration?: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/grammar/videos/${videoId}/mark-watched`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId, videoTitle, videoDuration }),
    });
    return response.json();
  },
  getGrammarVideoAnalysis: async (videoId: string, conceptId?: string) => {
    const query = conceptId ? `?conceptId=${conceptId}` : '';
    const response = await fetchWithAuth(`/api/v1/protected/grammar/videos/${videoId}/analysis${query}`);
    return response.json();
  },
  getWatchedVideosForConcept: async (conceptId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/grammar/concepts/${conceptId}/watched-videos`);
    return response.json();
  },
  getVideoWatchedStatus: async (videoId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/grammar/videos/${videoId}/watched-status`);
    return response.json();
  },
  triggerVideoAnalysis: async (videoId: string, conceptId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/grammar/videos/${videoId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId }),
    });
    return response.json();
  },
  // Reading comprehension endpoints
  getDailyReadingTasks: async () => {
    const response = await fetchWithAuth('/api/v1/protected/reading/daily');
    return response.json();
  },
  getReadingText: async (textId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/reading/${textId}`);
    return response.json();
  },
  submitReadingAnswer: async (textId: string, questionId: string, userAnswer: string, sessionId?: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/reading/${textId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, userAnswer, sessionId }),
    });
    return response.json();
  },
  completeReadingTask: async (textId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/reading/${textId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },
  getReadingStats: async () => {
    const response = await fetchWithAuth('/api/v1/protected/reading/stats');
    return response.json();
  },
  getReadingHistory: async (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetchWithAuth(`/api/v1/protected/reading/history${query}`);
    return response.json();
  },
  // Anki deck import endpoints
  importAnkiDeck: async (file: File, customName?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (customName) {
      formData.append('name', customName);
    }
    
    const token = await getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    const response = await fetch(`${API_BASE_URL}/api/v1/protected/anki/import`, {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw createAPIError(response.status, errorData.error || 'Failed to import deck');
    }
    
    return response.json();
  },
  getAnkiDecks: async () => {
    const response = await fetchWithAuth('/api/v1/protected/anki/decks');
    return response.json();
  },
  getAnkiDeck: async (deckId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/anki/decks/${deckId}`);
    return response.json();
  },
  deleteAnkiDeck: async (deckId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/anki/decks/${deckId}`, {
      method: 'DELETE',
    });
    return response.json();
  },
  getAnkiStudyCards: async (deckId: string, maxNew?: number, maxReview?: number) => {
    const params = new URLSearchParams();
    if (maxNew) params.append('maxNew', maxNew.toString());
    if (maxReview) params.append('maxReview', maxReview.toString());
    const query = params.toString();
    const response = await fetchWithAuth(`/api/v1/protected/anki/decks/${deckId}/study${query ? `?${query}` : ''}`);
    return response.json();
  },
  reviewAnkiCard: async (deckId: string, cardId: string, quality: number) => {
    const response = await fetchWithAuth(`/api/v1/protected/anki/decks/${deckId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, quality }),
    });
    return response.json();
  },
  getAnkiDeckStats: async (deckId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/anki/decks/${deckId}/stats`);
    return response.json();
  },
  getAnkiTotalDueCount: async () => {
    const response = await fetchWithAuth('/api/v1/protected/anki/due-count');
    return response.json();
  },
}; 