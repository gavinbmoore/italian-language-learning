import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/serverComm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Trophy, X } from 'lucide-react';

interface Message {
  role: 'tutor' | 'student';
  content: string;
  timestamp: string;
  correction?: {
    original: string;
    corrected: string;
    explanation: string;
  };
  wasCorrect?: boolean;
}

interface ConversationContext {
  messages: Message[];
  topicsCovered: string[];
  correctCount: number;
  totalExchanges: number;
  currentDifficulty: string;
}

interface UnknownWord {
  word: string;
  sentence: string;
  translation?: string;
}

interface SessionFeedback {
  summary: string;
  areasOfStrength: string[];
  areasForImprovement: string[];
  specificRecommendations: string[];
  errorPatterns: string[];
  session: {
    totalExchanges: number;
    correctCount: number;
    accuracy: string;
  };
  difficultyFeedback?: string;
}

interface ConversationalGrammarPracticeProps {
  conceptId: string;
  conceptName: string;
  onComplete: () => void;
  onClose: () => void;
  onTriggerPracticeReview?: (cards: FlashcardData[]) => void;
}

interface FlashcardData {
  id: string;
  word: string;
  word_original: string;
  translation: string | null;
  example_sentence: string | null;
}

export function ConversationalGrammarPractice({
  conceptId,
  conceptName,
  onComplete,
  onClose,
  onTriggerPracticeReview,
}: ConversationalGrammarPracticeProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [difficultyMessage, setDifficultyMessage] = useState<string | null>(null);
  const [unknownWords, setUnknownWords] = useState<Map<string, UnknownWord>>(new Map());
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [showDifficultyRating, setShowDifficultyRating] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedback | null>(null);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startConversation();
  }, [conceptId]);

  // Auto-scroll to bottom when new messages arrive or when loading completes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [context?.messages, sending, loading]);

  // Auto-focus input field on mount and after sending
  useEffect(() => {
    if (!sending && !loading && !showSessionSummary && !showDifficultyRating) {
      inputRef.current?.focus();
    }
  }, [sending, loading, showSessionSummary, showDifficultyRating]);

  const startConversation = async () => {
    try {
      setLoading(true);
      const response = await api.startGrammarConversation(conceptId);
      setSessionId(response.sessionId);
      setContext(response.context);
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || !context || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    try {
      const response = await api.continueGrammarConversation(
        conceptId,
        sessionId,
        userMessage,
        context
      );

      setContext(response.context);

      // Show difficulty adjustment message if any
      if (response.difficultyAdjusted) {
        setDifficultyMessage(response.difficultyAdjusted.reason);
        setTimeout(() => setDifficultyMessage(null), 5000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleWordClick = (word: string, sentence: string) => {
    const normalizedWord = word.toLowerCase().trim();
    
    setUnknownWords((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(normalizedWord)) {
        // Word already selected, remove it
        newMap.delete(normalizedWord);
      } else {
        // Add new word
        newMap.set(normalizedWord, {
          word: word,
          sentence: sentence,
        });
      }
      return newMap;
    });
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

  const endSession = async () => {
    if (!sessionId || !context) return;
    
    // First, show difficulty rating dialog
    setShowDifficultyRating(true);
  };

  const handleDifficultyRating = async (rating: 'easy' | 'medium' | 'difficult') => {
    if (!sessionId || !context) return;

    try {
      setShowDifficultyRating(false);
      setLoading(true);
      
      // Save the rating and end the conversation
      const response = await api.endGrammarConversation(conceptId, sessionId, context, rating);
      
      // Add feedback message based on rating
      let feedbackMessage = '';
      if (rating === 'easy') {
        feedbackMessage = "Got it! 💪 Next session will be more challenging.";
      } else if (rating === 'medium') {
        feedbackMessage = "Perfect! 👍 We'll keep the same difficulty level.";
      } else {
        feedbackMessage = "No problem! 📚 Next session will be a bit easier.";
      }
      
      // Store feedback to show in summary
      const enhancedResponse = {
        ...response,
        difficultyFeedback: feedbackMessage,
      };
      
      setSessionFeedback(enhancedResponse);
      
      // If there are unknown words, get translations
      if (unknownWords.size > 0) {
        setLoadingTranslations(true);
        try {
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
          
          // Select all words by default
          setSelectedWords(new Set(unknownWords.keys()));
        } catch (error) {
          console.error('Failed to get translations:', error);
        } finally {
          setLoadingTranslations(false);
        }
      }
      
      setShowSessionSummary(true);
      setLoading(false);
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session. Please try again.');
      setLoading(false);
    }
  };

  const handleWordToggle = (word: string) => {
    setSelectedWords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(word)) {
        newSet.delete(word);
      } else {
        newSet.add(word);
      }
      return newSet;
    });
  };

  const handleSaveWords = async () => {
    try {
      const wordsArray = Array.from(selectedWords).map(word => unknownWords.get(word)!);
      
      // Save words
      await api.saveUnknownWords(wordsArray);
      
      // Transform words to flashcard format
      const flashcards: FlashcardData[] = wordsArray.map((wordObj, index) => ({
        id: `practice-${Date.now()}-${index}`,
        word: wordObj.word.toLowerCase(),
        word_original: wordObj.word,
        translation: wordObj.translation || null,
        example_sentence: wordObj.sentence,
      }));
      
      // Close summary
      setShowSessionSummary(false);
      
      // Trigger practice review with flashcards
      if (onTriggerPracticeReview && flashcards.length > 0) {
        onTriggerPracticeReview(flashcards);
      }
      
      // Complete
      onComplete();
    } catch (error) {
      console.error('Failed to save words:', error);
      alert('Failed to save words. Please try again.');
    }
  };

  const handleSkipWords = () => {
    setShowSessionSummary(false);
    onComplete();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const accuracy = context && context.totalExchanges > 0
    ? Math.round((context.correctCount / context.totalExchanges) * 100)
    : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Practicing: {conceptName}</h3>
          <p className="text-sm text-muted-foreground">Chat with your AI grammar tutor</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span>
            Accuracy: {context?.correctCount || 0}/{context?.totalExchanges || 0} ({accuracy}%)
          </span>
        </div>
        <Badge className="capitalize">{context?.currentDifficulty || 'easy'}</Badge>
        {unknownWords.size > 0 && (
          <Badge variant="secondary" className="bg-learning/20 text-learning border-learning/40">
            📝 {unknownWords.size} word{unknownWords.size !== 1 ? 's' : ''} marked
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={endSession} disabled={!context?.totalExchanges}>
          Finish Session
        </Button>
      </div>

      {/* Difficulty Change Message */}
      {difficultyMessage && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm font-medium text-primary">🎯 {difficultyMessage}</p>
        </div>
      )}

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
          <div className="space-y-4">
            {context?.messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'student' ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`rounded-lg p-3 ${
                      msg.role === 'tutor'
                        ? 'bg-muted text-foreground'
                        : msg.wasCorrect === false
                        ? 'bg-destructive/10 border border-destructive/20'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {msg.role === 'tutor' && (
                      <p className="text-xs font-semibold mb-1 text-primary">AI Tutor</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">
                      {renderClickableMessage(msg.content, msg.content, msg.role === 'student')}
                    </p>
                  </div>

                  {/* Show correction if there was an error */}
                  {msg.correction && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded text-xs">
                      <p className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                        📝 Correction:
                      </p>
                      <p className="text-red-600 dark:text-red-400 line-through">
                        {msg.correction.original}
                      </p>
                      <p className="text-green-600 dark:text-green-400 font-medium">
                        ✓ {msg.correction.corrected}
                      </p>
                      <p className="text-muted-foreground mt-1 italic">
                        {msg.correction.explanation}
                      </p>
                    </div>
                  )}

                  {msg.wasCorrect === true && msg.role === 'student' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Correct!</p>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <CardContent className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your response in Italian..."
              disabled={sending}
              className="flex-1"
              autoFocus
            />
            <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send • Your tutor will correct mistakes in real-time
          </p>
        </CardContent>
      </Card>

      {/* Difficulty Rating Dialog */}
      {showDifficultyRating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-2">How was this session?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your feedback helps us adjust the difficulty for next time
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={() => handleDifficultyRating('easy')}
                  className="h-16 text-lg bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  😊 Too Easy
                </Button>
                <Button
                  onClick={() => handleDifficultyRating('medium')}
                  className="h-16 text-lg bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  👍 Just Right
                </Button>
                <Button
                  onClick={() => handleDifficultyRating('difficult')}
                  className="h-16 text-lg bg-orange-600 hover:bg-orange-700"
                  size="lg"
                >
                  😅 Too Difficult
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session Summary Modal */}
      {showSessionSummary && sessionFeedback && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">🎉 Session Complete!</h2>
                <Button variant="ghost" size="icon" onClick={handleSkipWords}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Difficulty Feedback Message */}
              {sessionFeedback.difficultyFeedback && (
                <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
                  <p className="text-lg font-semibold text-primary">{sessionFeedback.difficultyFeedback}</p>
                </div>
              )}

              {/* Session Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{sessionFeedback.session.totalExchanges}</p>
                  <p className="text-sm text-muted-foreground">Total Exchanges</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{sessionFeedback.session.correctCount}</p>
                  <p className="text-sm text-muted-foreground">Correct</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{sessionFeedback.session.accuracy}%</p>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                </Card>
              </div>

              {/* AI Feedback */}
              <Card className="p-6 mb-6 bg-gradient-to-br from-primary/5 to-primary/10">
                <h3 className="text-lg font-semibold mb-3">📊 Your Performance</h3>
                <p className="text-sm mb-4">{sessionFeedback.summary}</p>

                {sessionFeedback.areasOfStrength.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">✅ Strengths:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {sessionFeedback.areasOfStrength.map((strength, idx) => (
                        <li key={idx} className="text-sm">{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {sessionFeedback.areasForImprovement.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-2">🎯 Focus Areas:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {sessionFeedback.areasForImprovement.map((area, idx) => (
                        <li key={idx} className="text-sm">{area}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {sessionFeedback.specificRecommendations.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">💡 Recommendations:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {sessionFeedback.specificRecommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {sessionFeedback.errorPatterns.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">⚠️ Common Patterns:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {sessionFeedback.errorPatterns.map((pattern, idx) => (
                        <li key={idx} className="text-sm">{pattern}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

              {/* Unknown Words */}
              {unknownWords.size > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">📝 Words to Learn</h3>
                  {loadingTranslations ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading translations...</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {Array.from(unknownWords.entries()).map(([word, data]) => (
                        <Card 
                          key={word}
                          className={`p-3 cursor-pointer transition-colors ${
                            selectedWords.has(word) ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                          }`}
                          onClick={() => handleWordToggle(word)}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedWords.has(word)}
                              onChange={() => handleWordToggle(word)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{data.word}</span>
                                {data.translation && (
                                  <span className="text-sm text-muted-foreground">→ {data.translation}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground italic">{data.sentence}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={handleSkipWords}>
                  {unknownWords.size > 0 ? 'Skip Words' : 'Close'}
                </Button>
                {unknownWords.size > 0 && selectedWords.size > 0 && (
                  <Button onClick={handleSaveWords} className="bg-learning hover:bg-learning/90">
                    Save & Practice ({selectedWords.size} word{selectedWords.size !== 1 ? 's' : ''})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

