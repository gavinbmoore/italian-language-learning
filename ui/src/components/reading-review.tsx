import { useState, useEffect } from 'react';
import { api } from '@/lib/serverComm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Trophy, BookMarked, Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReadingPracticeSession } from './reading-practice-session';

interface Answer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean | null;
  feedback: string;
  score: number;
}

interface Translation {
  word: string;
  translation: string;
  wordType?: string;
}

interface ReadingReviewProps {
  textId: string;
  textTitle: string;
  unknownWords: string[];
  textContent: string;
  answers: Answer[];
  totalQuestions: number;
  onComplete: () => void;
}

export function ReadingReview({
  textId,
  textTitle,
  unknownWords,
  textContent,
  answers,
  totalQuestions,
  onComplete,
}: ReadingReviewProps) {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [savingWords, setSavingWords] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [practiceCompleted, setPracticeCompleted] = useState(false);

  useEffect(() => {
    if (unknownWords.length > 0) {
      loadTranslations();
    }
  }, [unknownWords]);

  const loadTranslations = async () => {
    try {
      setLoadingTranslations(true);
      const translationsData = await api.translateWords(unknownWords);
      setTranslations(translationsData);
    } catch (error) {
      console.error('Error loading translations:', error);
    } finally {
      setLoadingTranslations(false);
    }
  };

  const handleStartPractice = () => {
    setShowPractice(true);
  };

  const handlePracticeComplete = async (practiceResults: any[]) => {
    console.log('Practice completed with results:', practiceResults);
    setPracticeCompleted(true);
    setShowPractice(false);
    
    // Automatically save to Anki after practice
    await handleSaveAndComplete();
  };

  const handleSaveAndComplete = async () => {
    try {
      setSavingWords(true);
      
      // Save unknown words if any
      if (unknownWords.length > 0) {
        console.log('Saving unknown words:', unknownWords);
        const wordsToSave = unknownWords.map((word) => {
          const translation = translations.find(t => t.word.toLowerCase() === word.toLowerCase());
          return {
            word,
            sentence: textContent.substring(0, 500), // Limit sentence length
            translation: translation?.translation,
          };
        });
        
        const saveResponse = await api.saveUnknownWords(wordsToSave);
        console.log('Words saved:', saveResponse);
      }
      
      // Mark reading as complete
      console.log('Marking reading as complete:', textId);
      await api.completeReadingTask(textId);
      
      setCompleted(true);
      
      // Wait a moment to show success message, then close
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error('Error saving words and completing task:', error);
      alert('Failed to save words. Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setSavingWords(false);
    }
  };
  
  const handleSkipAndContinue = () => {
    // Just mark as complete without saving words
    api.completeReadingTask(textId)
      .then(() => {
        console.log('Task completed without saving words');
        onComplete();
      })
      .catch((error) => {
        console.error('Error completing task:', error);
        onComplete(); // Still close even if there's an error
      });
  };

  // Only calculate scores if there are questions
  const hasQuestions = totalQuestions > 0;
  const correctAnswers = hasQuestions ? answers.filter(a => a.isCorrect).length : 0;
  const scorePercentage = hasQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  
  // Calculate partial credit score
  const totalScore = hasQuestions ? answers.reduce((sum, a) => sum + (a.score || 0), 0) : 0;
  const adjustedPercentage = hasQuestions ? Math.round((totalScore / totalQuestions) * 100) : 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold mb-2">Reading Complete!</h1>
        <p className="text-muted-foreground">{textTitle}</p>
      </div>

      {/* Vocabulary Section */}
      {unknownWords.length > 0 ? (
        <Card className="mb-6 border-learning/40">
          <CardHeader className="bg-learning/5">
            <div className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-learning" />
              <CardTitle>📚 New Vocabulary to Learn</CardTitle>
            </div>
            <CardDescription>
              {unknownWords.length} {unknownWords.length === 1 ? 'word' : 'words'} you marked as unknown - these will be added to your Anki flashcard deck
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTranslations ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading translations...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unknownWords.map((word) => {
                  const translation = translations.find(
                    t => t.word.toLowerCase() === word.toLowerCase()
                  );
                  return (
                    <div
                      key={word}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{word}</p>
                        <p className="text-sm text-muted-foreground">
                          {translation?.translation || 'Loading...'}
                        </p>
                      </div>
                      {translation?.wordType && (
                        <Badge variant="outline" className="text-xs">
                          {translation.wordType}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm font-medium mb-2">
                ✨ Practice these words now!
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Practice with interactive flashcards</li>
                <li>• Start with Italian → English recognition</li>
                <li>• Progress to English → Italian production</li>
                <li>• Words are saved to Anki after practice</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>No New Vocabulary</CardTitle>
            <CardDescription>
              You didn't mark any words as unknown. Great job!
            </CardDescription>
          </CardHeader>
        </Card>
      )}


      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          onClick={handleSkipAndContinue}
          disabled={savingWords || completed}
        >
          {unknownWords.length > 0 ? 'Skip & Continue' : 'Continue'}
        </Button>
        {unknownWords.length > 0 && !practiceCompleted && (
          <Button
            onClick={handleStartPractice}
            disabled={savingWords || completed || loadingTranslations}
            size="lg"
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Practice {unknownWords.length} {unknownWords.length === 1 ? 'Word' : 'Words'} Now
          </Button>
        )}
        {unknownWords.length > 0 && practiceCompleted && (
          <Button
            disabled={true}
            size="lg"
            className="bg-gradient-to-r from-mastered to-mastered/80"
          >
            {savingWords ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving to Anki...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Saved to Anki!
              </>
            )}
          </Button>
        )}
      </div>

      {/* Practice Session */}
      {unknownWords.length > 0 && (
        <ReadingPracticeSession
          open={showPractice}
          onOpenChange={setShowPractice}
          words={unknownWords.map(word => {
            const translation = translations.find(t => t.word.toLowerCase() === word.toLowerCase());
            return {
              word,
              translation: translation?.translation || 'Translation loading...',
              sentence: textContent.substring(0, 500),
            };
          })}
          onComplete={handlePracticeComplete}
        />
      )}

      {/* Success Dialog */}
      <Dialog open={completed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-mastered" />
              Task Completed!
            </DialogTitle>
            <DialogDescription className="text-center">
              {unknownWords.length > 0 ? (
                <>
                  <p className="mb-2">
                    {practiceCompleted ? 'Great practice! ' : ''}{unknownWords.length} new {unknownWords.length === 1 ? 'word' : 'words'} added to your flashcard deck.
                  </p>
                  <p className="text-sm">
                    {practiceCompleted 
                      ? "You've practiced these words and they're scheduled for review tomorrow."
                      : "You'll review them in your daily Anki practice."}
                  </p>
                </>
              ) : (
                <p>Great job! You completed this reading task.</p>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

