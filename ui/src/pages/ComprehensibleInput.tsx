import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/serverComm';
import { shuffleArray } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { LearningTimer } from '@/components/learning-timer';
import { MessageSquare, BookOpen, Target, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GrammarError {
  errorText: string;
  conceptId: string;
  conceptName: string;
  severity: string;
  correction: string;
  explanation: string;
}

interface Message {
  id: string;
  message_type: 'user' | 'assistant';
  content: string;
  comprehensibility_score?: number;
  new_words_count?: number;
  known_words_count?: number;
  total_words_count?: number;
  new_words?: string[];
  grammar_errors?: GrammarError[];
  created_at: string;
}

interface Proficiency {
  id: string;
  level: string;
  vocabulary_size: number;
  comprehension_score: number;
}

interface UnknownWord {
  word: string;
  sentence: string;
  translation?: string;
}

interface FlashcardData {
  id: string;
  word: string;
  word_original: string;
  translation: string | null;
  example_sentence: string | null;
}

interface ComprehensibleInputConversationProps {
  onTriggerPracticeReview?: (cards: FlashcardData[]) => void;
}

interface ConversationSession {
  sessionId: string;
  messageCount: number;
  firstMessage: string;
  lastMessageTime: Date;
  startTime: Date;
  endTime?: Date;
}

export function ComprehensibleInputConversation({ onTriggerPracticeReview }: ComprehensibleInputConversationProps = {}) {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proficiency, setProficiency] = useState<Proficiency | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [unknownWords, setUnknownWords] = useState<Map<string, UnknownWord>>(new Map());
  const [showLessonSummary, setShowLessonSummary] = useState(false);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<ConversationSession[]>([]);
  const [lastSessionSummary, setLastSessionSummary] = useState<string | null>(null);
  const [showSummaryBadge, setShowSummaryBadge] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load data when auth completes, or after a timeout to avoid infinite loading
    const timer = setTimeout(() => {
      if (!authLoading || user) {
        loadProficiency();
        loadRecentSessions();
        loadLastSessionSummary();
      }
    }, 2000); // Wait max 2 seconds for auth

    if (user && !authLoading) {
      clearTimeout(timer);
      loadProficiency();
      loadRecentSessions();
      loadLastSessionSummary();
    }

    return () => clearTimeout(timer);
  }, [user, authLoading]);

  // Auto-focus input on mount and after messages
  useEffect(() => {
    inputRef.current?.focus();
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProficiency = async () => {
    try {
      const data = await api.getProficiency();
      setProficiency(data.proficiency);
    } catch (error) {
      console.error('Failed to load proficiency:', error);
      // If authentication fails, user might not be ready yet
      if (error instanceof Error && error.message.includes('Authentication')) {
        console.log('Waiting for authentication to complete...');
      }
    }
  };

  const loadRecentSessions = async () => {
    try {
      const data = await api.getRecentSessions(5);
      if (data.sessions && Array.isArray(data.sessions)) {
        setRecentSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to load recent sessions:', error);
    }
  };

  const loadLastSessionSummary = async () => {
    try {
      const data = await api.getLastSessionSummary();
      if (data.summary) {
        setLastSessionSummary(data.summary);
        setShowSummaryBadge(true);
      }
    } catch (error) {
      console.error('Failed to load last session summary:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const data = await api.getSessionMessages(sessionId);
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setCurrentSessionId(sessionId);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load conversation. Please try again.');
    }
  };

  const clearCurrentSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setUnknownWords(new Map());
    setCurrentAnalysis(null);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message to chat immediately
    const userMessageObj: Message = {
      id: 'user-' + Date.now(),
      message_type: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessageObj]);

    try {
      // Get or create session ID if we don't have one
      let sessionId = currentSessionId;
      if (!sessionId) {
        const activeSession = await api.getActiveSession();
        if (activeSession.session) {
          sessionId = activeSession.session.id;
          setCurrentSessionId(sessionId);
        }
      }
      
      // Analyze the message
      const analysis = await api.analyzeText(userMessage);
      setCurrentAnalysis(analysis);

      // Generate AI response using ChatGPT with i+1 comprehensibility
      const aiResponse = await api.generateAIResponse(userMessage, sessionId || undefined);
      
      console.log('AI Response:', aiResponse);
      console.log('Comprehensibility Score:', aiResponse.comprehensibilityScore);
      console.log('Adjustment:', aiResponse.adjustment);
      
      // Log if this was a new session with topic suggestion
      if (aiResponse.isNewSession) {
        console.log('🎯 New session detected!');
        if (aiResponse.suggestedTopic) {
          console.log('✨ Suggested topic:', aiResponse.suggestedTopic);
        }
      }

      // Add grammar errors to the user message if detected
      if (aiResponse.grammarAnalysis?.errors && aiResponse.grammarAnalysis.errors.length > 0) {
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const userMessageIndex = updatedMessages.findIndex(m => m.id === userMessageObj.id);
          if (userMessageIndex !== -1) {
            updatedMessages[userMessageIndex] = {
              ...updatedMessages[userMessageIndex],
              grammar_errors: aiResponse.grammarAnalysis.errors,
            };
          }
          return updatedMessages;
        });
      }

      // Add AI response to chat
      const aiMessageObj: Message = {
        id: 'ai-' + Date.now(),
        message_type: 'assistant',
        content: aiResponse.response,
        comprehensibility_score: aiResponse.comprehensibilityScore,
        new_words_count: aiResponse.analysis?.newWords?.length || 0,
        known_words_count: aiResponse.analysis?.knownWords?.length || 0,
        total_words_count: aiResponse.analysis?.totalWords || 0,
        new_words: aiResponse.analysis?.newWords || [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessageObj]);

      // Update proficiency
      await loadProficiency();
      setCurrentAnalysis(null);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to send message: ${errorMessage}\n\nPlease check the console for more details.`);
    } finally {
      setLoading(false);
      // Focus input field after sending message
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };


  const handleMarkWordKnown = async (word: string) => {
    try {
      await api.markWordsAsKnown([word]);
      await loadProficiency();
      // Reload current message analysis if available
      if (input) {
        const analysis = await api.analyzeText(input);
        setCurrentAnalysis(analysis);
      }
    } catch (error) {
      console.error('Failed to mark word as known:', error);
    }
  };

  const handleWordClick = (word: string, sentence: string) => {
    const normalizedWord = word.toLowerCase().trim();
    if (!normalizedWord) return;

    setUnknownWords((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(normalizedWord)) {
        // Remove word if already clicked (toggle)
        newMap.delete(normalizedWord);
      } else {
        // Add word with sentence context
        newMap.set(normalizedWord, { word: normalizedWord, sentence });
      }
      return newMap;
    });
  };

  const handleEndLesson = async () => {
    if (unknownWords.size === 0) {
      alert('No unknown words were marked during this lesson.');
      return;
    }

    setLoadingTranslations(true);
    setShowLessonSummary(true);

    try {
      // Get translations for all unknown words
      const wordsToTranslate = Array.from(unknownWords.keys());
      const translations = await api.translateWords(wordsToTranslate);

      // Update unknown words with translations
      setUnknownWords((prev) => {
        const newMap = new Map(prev);
        translations.forEach((translation: any) => {
          const existingWord = newMap.get(translation.word);
          if (existingWord) {
            newMap.set(translation.word, {
              ...existingWord,
              translation: translation.translation,
            });
          }
        });
        return newMap;
      });
    } catch (error) {
      console.error('Failed to get translations:', error);
      alert('Failed to get translations. Please try again.');
    } finally {
      setLoadingTranslations(false);
    }
  };

  const handleSaveUnknownWords = async () => {
    try {
      const wordsArray = Array.from(unknownWords.values());
      
      // Save words with session ID to end the session
      await api.saveUnknownWords(wordsArray, currentSessionId || undefined);
      
      // Close the lesson summary modal
      setShowLessonSummary(false);
      
      // Transform words to flashcard format
      const flashcards: FlashcardData[] = wordsArray.map((wordObj, index) => ({
        id: `practice-${Date.now()}-${index}`,
        word: wordObj.word.toLowerCase(),
        word_original: wordObj.word,
        translation: wordObj.translation || null,
        example_sentence: wordObj.sentence,
      }));
      
      // Shuffle the cards for better learning
      const shuffledCards = shuffleArray(flashcards);
      
      // Clear the current session and start fresh
      clearCurrentSession();
      
      // Reload recent sessions to include the just-ended session
      await loadRecentSessions();
      
      // Trigger practice review with shuffled cards
      if (onTriggerPracticeReview && shuffledCards.length > 0) {
        onTriggerPracticeReview(shuffledCards);
      }
    } catch (error) {
      console.error('Failed to save unknown words:', error);
      alert('Failed to save words. Please try again.');
    }
  };

  const renderClickableMessage = (content: string, sentence: string, isUserMessage: boolean = false) => {
    // Split text into words and punctuation, preserving Italian characters
    const regex = /(\b[\p{L}]+\b|[^\p{L}\s]+|\s+)/gu;
    const parts = content.match(regex) || [];

    return (
      <span>
        {parts.map((part, idx) => {
          // Check if this is a word (contains letters)
          const isWord = /[\p{L}]+/u.test(part);
          if (isWord) {
            const normalizedWord = part.toLowerCase().trim();
            const isSelected = unknownWords.has(normalizedWord);
            
            // Different hover styles for user vs assistant messages
            const hoverClass = isUserMessage
              ? 'hover:bg-learning/30 hover:scale-105'
              : 'hover:bg-learning/20 hover:scale-105';
            
            const selectedClass = isSelected
              ? 'bg-learning/40 dark:bg-learning/30 font-semibold ring-2 ring-learning/50'
              : '';
            
            return (
              <span
                key={idx}
                onClick={() => handleWordClick(part, sentence)}
                className={`cursor-pointer inline-block rounded px-1 transition-all duration-150 ${hoverClass} ${selectedClass}`}
                title="Click to mark as unknown"
              >
                {part}
              </span>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </span>
    );
  };

  const getComprehensibilityColor = (score?: number) => {
    if (!score) return 'bg-muted';
    if (score >= 0.80 && score <= 0.85) return 'bg-mastered shadow-mastered/50'; // Perfect range
    if (score >= 0.75 && score < 0.90) return 'bg-learning shadow-learning/50'; // Close to target
    if (score < 0.75) return 'bg-due shadow-due/50'; // Too difficult
    return 'bg-primary shadow-primary/50'; // Too easy
  };

  const getComprehensibilityLabel = (score?: number) => {
    if (!score) return 'N/A';
    const percentage = Math.round(score * 100);
    return `${percentage}%`;
  };

  // Show loading state while authentication is in progress
  // Allow access even without full auth for development
  if (authLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Italian learning environment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <LearningTimer 
        pageContext="comprehensible-input" 
        autoStart={false} 
        variant="full"
        className="mb-6"
      />
      
      {/* Last Session Summary Badge */}
      {lastSessionSummary && showSummaryBadge && messages.length === 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  🔄 Continuing from last session
                </span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {lastSessionSummary}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSummaryBadge(false)}
              className="shrink-0 h-6 w-6 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              ✕
            </Button>
          </div>
        </div>
      )}
      
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-primary" />
                Comprehensible Input (i+1)
              </CardTitle>
              <CardDescription className="mt-2">
                Learn Italian through AI conversations perfectly tailored to your level
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {unknownWords.size > 0 && (
                <Button
                  onClick={handleEndLesson}
                  variant="default"
                  className="btn-press bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
                  disabled={showLessonSummary || loadingTranslations}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  End Lesson ({unknownWords.size})
                </Button>
              )}
              {proficiency && (
                <div className="text-right bg-primary/5 rounded-xl p-3 border border-primary/20">
                  <Badge variant="secondary" className="text-base px-3 py-1 bg-gradient-to-r from-primary/20 to-primary/10">
                    Level: {proficiency.level}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {proficiency.vocabulary_size} words mastered
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Comprehensibility Score: {getComprehensibilityLabel(proficiency?.comprehension_score)}
                </div>
                <div className="relative w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ease-out ${getComprehensibilityColor(
                      proficiency?.comprehension_score
                    )}`}
                    style={{
                      width: `${(proficiency?.comprehension_score || 0) * 100}%`,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" style={{animation: 'shimmer 2s infinite'}} />
                </div>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg">
                Target: 80-85%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 shadow-md border-border/50">
        <CardContent className="p-6">
          <div className="space-y-6 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="text-center py-12 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">Ready to practice Italian?</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Start a conversation and the AI will adapt to keep it at your perfect comprehension level (80-85%)
                </p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex ${message.message_type === 'user' ? 'justify-end' : 'justify-start'} animate-in`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                        message.message_type === 'user'
                          ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground'
                          : 'bg-card border border-border/50'
                      }`}
                    >
                      <div className={`text-base leading-relaxed whitespace-pre-wrap ${
                        message.message_type === 'user' ? '' : 'italian-text'
                      }`}>
                        {renderClickableMessage(
                          message.content, 
                          message.content,
                          message.message_type === 'user'
                        )}
                      </div>
                      {message.new_words && message.new_words.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-1.5">
                          {message.new_words.slice(0, 5).map((word, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs cursor-pointer hover:bg-learning hover:text-learning-foreground hover:border-learning transition-all hover:scale-105 btn-press"
                              onClick={() => handleMarkWordKnown(word)}
                              title="Click to mark as known"
                            >
                              {word}
                            </Badge>
                          ))}
                          {message.new_words.length > 5 && (
                            <Badge variant="outline" className="text-xs bg-muted">
                              +{message.new_words.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                      {message.grammar_errors && message.grammar_errors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Sparkles className="h-3 w-3" />
                            <span>Grammar Tip{message.grammar_errors.length > 1 ? 's' : ''}</span>
                          </div>
                          {message.grammar_errors.slice(0, 2).map((error, idx) => (
                            <div
                              key={idx}
                              className="p-2 bg-primary-foreground/5 rounded-lg text-sm space-y-1"
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-due">✗</span>
                                <span className="line-through opacity-70">{error.errorText}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-mastered">✓</span>
                                <span className="font-medium">{error.correction}</span>
                              </div>
                              <p className="text-xs opacity-80 ml-5">{error.explanation}</p>
                            </div>
                          ))}
                          {message.grammar_errors.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{message.grammar_errors.length - 2} more tips
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start animate-in">
                    <div className="max-w-[85%] rounded-2xl p-4 bg-card border border-border/50 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-muted-foreground">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>

      {currentAnalysis && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">Current Message Analysis:</span>
                <Badge
                  variant="outline"
                  className={getComprehensibilityColor(currentAnalysis.analysis.comprehensibilityScore)}
                >
                  {getComprehensibilityLabel(currentAnalysis.analysis.comprehensibilityScore)} understood
                </Badge>
              </div>
              <div className="text-muted-foreground">
                Known: {currentAnalysis.analysis.knownWords} | New:{' '}
                {currentAnalysis.analysis.newWords} | Total:{' '}
                {currentAnalysis.analysis.totalWords}
              </div>
              {currentAnalysis.adjustment !== 'maintain' && (
                <div className="mt-2">
                  <Badge
                    variant={currentAnalysis.adjustment === 'simplify' ? 'warning' : 'success'}
                  >
                    {currentAnalysis.adjustment === 'simplify'
                      ? 'Content too difficult - simplifying'
                      : 'Content too easy - increasing complexity'}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md border-border/50 sticky bottom-6">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && input.trim() && handleSend()}
              placeholder="Scrivi in italiano... (Type in Italian...)"
              disabled={loading}
              className="flex-1 h-12 text-base border-border/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              autoFocus
            />
            <Button 
              onClick={handleSend} 
              disabled={loading || !input.trim()}
              className="btn-press h-12 px-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending
                </span>
              ) : (
                'Send'
              )}
            </Button>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-accent/30 p-3 rounded-lg">
            <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary" />
            <p>
              <strong className="text-foreground">Tip:</strong> Click on any word you don't know to mark it. At the end of your lesson, you'll get translations and add them to your flashcards.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lesson Summary Modal */}
      <Dialog open={showLessonSummary} onOpenChange={setShowLessonSummary}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col glass-card">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Lesson Complete! 🎉</DialogTitle>
                <DialogDescription className="text-base mt-1">
                  Review your {unknownWords.size} new word{unknownWords.size !== 1 ? 's' : ''} before saving them
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
            {loadingTranslations ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                <p className="text-lg font-medium text-foreground">Getting translations...</p>
                <p className="text-sm text-muted-foreground mt-1">This will just take a moment</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Grammar Insights Section */}
                {(() => {
                  const allGrammarErrors = messages
                    .filter(m => m.message_type === 'user' && m.grammar_errors && m.grammar_errors.length > 0)
                    .flatMap(m => m.grammar_errors || []);
                  
                  if (allGrammarErrors.length > 0) {
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <span>Grammar Insights ({allGrammarErrors.length})</span>
                        </div>
                        <div className="space-y-2">
                          {allGrammarErrors.slice(0, 5).map((error, idx) => (
                            <Card key={idx} className="p-4 border-primary/20 bg-gradient-to-br from-card to-accent/5">
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {error.conceptName}
                                  </Badge>
                                  <Badge 
                                    variant={error.severity === 'high' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {error.severity}
                                  </Badge>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-due">✗</span>
                                  <span className="line-through opacity-70">{error.errorText}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-mastered">✓</span>
                                  <span className="font-medium">{error.correction}</span>
                                </div>
                                <p className="text-sm text-muted-foreground ml-5">{error.explanation}</p>
                              </div>
                            </Card>
                          ))}
                          {allGrammarErrors.length > 5 && (
                            <p className="text-sm text-muted-foreground text-center">
                              +{allGrammarErrors.length - 5} more grammar insights
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Unknown Words Section */}
                {unknownWords.size > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span>New Vocabulary ({unknownWords.size})</span>
                    </div>
                    {Array.from(unknownWords.values()).map((wordObj, idx) => (
                  <Card key={idx} className="p-5 card-lift border-learning/20 bg-gradient-to-br from-card to-accent/5 animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold italian-text bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                              {wordObj.word}
                            </div>
                            {wordObj.translation && (
                              <div className="px-3 py-1 rounded-lg bg-learning/10 border border-learning/30">
                                <span className="text-sm font-medium text-learning">{wordObj.translation}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-sm bg-muted/50 p-3 rounded-lg italic border border-border/50 leading-relaxed">
                            <span className="text-muted-foreground mr-1">Example:</span>
                            <span className="italian-text text-foreground">"{wordObj.sentence}"</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUnknownWords((prev) => {
                              const newMap = new Map(prev);
                              newMap.delete(wordObj.word);
                              return newMap;
                            });
                          }}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 btn-press flex-shrink-0"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowLessonSummary(false)}
              className="btn-press"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUnknownWords}
              disabled={loadingTranslations || unknownWords.size === 0}
              className="btn-press bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Save & Practice with Flashcards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversation History */}
      {recentSessions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Previous Conversations</CardTitle>
            <CardDescription>
              Click on a previous conversation to view and continue it
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => loadSession(session.sessionId)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted ${
                    currentSessionId === session.sessionId
                      ? 'bg-muted border-primary'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.firstMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.lastMessageTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


