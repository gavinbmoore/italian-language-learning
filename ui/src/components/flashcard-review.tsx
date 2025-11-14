import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';

interface FlashcardData {
  id: string;
  word: string;
  word_original: string;
  translation: string | null;
  example_sentence: string | null;
  learning_step?: number | null;
}

interface QueuedCard {
  card: FlashcardData;
  showAfter: number; // Index position when card should appear again (not timestamp)
}

interface FlashcardReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: FlashcardData[];
  onReviewCard: (cardId: string, quality: number) => Promise<any>;
  onComplete: () => void;
  practiceMode?: boolean;
}

export function FlashcardReview({
  open,
  onOpenChange,
  cards,
  onReviewCard,
  onComplete,
  practiceMode = false,
}: FlashcardReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<QueuedCard[]>([]);
  const [allCards, setAllCards] = useState<FlashcardData[]>([]);

  // Get current card from allCards array
  const currentCard = allCards[currentIndex];
  const totalCards = cards.length; // Original due cards count
  const totalInSession = allCards.length; // Including learning cards in queue

  // Reset state when dialog opens/closes or cards change
  useEffect(() => {
    if (open && cards.length > 0) {
      setAllCards([...cards]); // Initialize with due cards
      setSessionQueue([]); // Clear queue
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsReviewing(false);
      setReviewedCount(0);
      setShowCompletion(false);
    }
  }, [open, cards]);

  // Keyboard shortcuts for flashcard review
  useEffect(() => {
    if (!open || isReviewing || showCompletion) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Prevent default behavior for arrow keys and space
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
      }

      // If card is not flipped, Space/Enter/Down/Up flips it
      if (!isFlipped && (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        handleFlip();
        return;
      }

      // If card is flipped, allow rating
      if (isFlipped) {
        // Check if card is in learning (show 3 buttons) or graduated (show 2 buttons)
        const isLearning = (currentCard?.learning_step ?? 0) >= 0 && (currentCard?.learning_step ?? 0) < 2;
        
        switch (event.key) {
          case 'ArrowLeft':
          case '1':
            // Left arrow or 1 = Again (Don't know)
            handleReview(1);
            break;
          case '2':
          case 'ArrowDown':
            // 2 or down = Good (for learning cards only)
            if (isLearning) {
              handleReview(4);
            }
            break;
          case 'ArrowRight':
          case ' ':
          case '3':
            // Right arrow, space, or 3 = Easy (Know) or Good for graduated cards
            if (isLearning) {
              handleReview(5); // Easy for learning cards
            } else {
              handleReview(5); // Easy for graduated cards (only 2 buttons)
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [open, isFlipped, isReviewing, showCompletion, currentCard]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleReview = async (quality: number) => {
    if (!currentCard || isReviewing) return;

    setIsReviewing(true);
    try {
      let result: any = null;
      
      // Only call API if NOT in practice mode
      if (!practiceMode) {
        result = await onReviewCard(currentCard.id, quality);
      }
      
      const newReviewedCount = reviewedCount + 1;
      setReviewedCount(newReviewedCount);

      // Check if card should stay in session (learning phase)
      if (result && result.result && result.result.in_session) {
        // Add card back to queue to appear after 3 more cards (Anki-style)
        const showAfter = currentIndex + 3;
        const updatedCard = { ...currentCard, learning_step: result.result.learning_step };
        console.log('🔄 Adding card to queue:', {
          word: currentCard.word_original,
          currentIndex,
          showAfter,
          learning_step: result.result.learning_step
        });
        setSessionQueue(prev => [...prev, { card: updatedCard, showAfter }]);
      }

      // Get next card from queue or advance to next card
      const nextQueuedCard = sessionQueue.find(q => q.showAfter <= currentIndex + 1);
      console.log('📋 Queue check:', {
        currentIndex,
        queueLength: sessionQueue.length,
        nextQueuedCard: nextQueuedCard ? { word: nextQueuedCard.card.word_original, showAfter: nextQueuedCard.showAfter } : null
      });
      
      if (nextQueuedCard) {
        // Show a learning card from queue - insert it at the next position
        console.log('✅ Showing queued card:', {
          word: nextQueuedCard.card.word_original,
          wasScheduledFor: nextQueuedCard.showAfter,
          nowAtIndex: currentIndex + 1
        });
        setSessionQueue(prev => prev.filter(q => q.card.id !== nextQueuedCard.card.id));
        setAllCards(prev => {
          const newCards = [...prev];
          // Insert the queued card at the next position
          newCards.splice(currentIndex + 1, 0, nextQueuedCard.card);
          return newCards;
        });
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else if (currentIndex + 1 >= allCards.length) {
        // Check if there are queued cards for later
        if (sessionQueue.length > 0) {
          // Add queued cards to the end
          const queuedCards = sessionQueue.map(q => q.card);
          setAllCards(prev => [...prev, ...queuedCards]);
          setSessionQueue([]);
          setCurrentIndex(currentIndex + 1);
          setIsFlipped(false);
        } else {
          // All done!
          setShowCompletion(true);
          setTimeout(() => {
            onComplete();
            onOpenChange(false);
          }, 2000);
        }
      } else {
        // Move to next card
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      }
    } catch (error) {
      console.error('Error reviewing card:', error);
      alert('Failed to review card. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  if (!open) return null;

  if (cards.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No Cards Due</DialogTitle>
            <DialogDescription>
              You don't have any flashcards due for review right now. Keep learning!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showCompletion) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg glass-card border-mastered/30">
          <div className="text-center py-12 animate-in">
            <div className="relative inline-block mb-6">
              <div className="text-8xl animate-bounce">🎉</div>
              <div className="absolute inset-0 bg-gradient-to-br from-mastered/20 to-primary/20 blur-3xl -z-10 animate-pulse"></div>
            </div>
            <DialogHeader>
              <DialogTitle className="text-3xl mb-2 bg-gradient-to-r from-mastered to-primary bg-clip-text text-transparent">
                Excellent Work!
              </DialogTitle>
              <DialogDescription className="text-lg">
                You've reviewed all {totalCards} flashcard{totalCards !== 1 ? 's' : ''}! 🌟
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-mastered/10 to-primary/10 border border-mastered/30">
              <p className="text-base font-medium text-foreground">
                Keep building that knowledge! 💪
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Consistent practice is the key to mastery
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl glass-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl flex items-center gap-2">
                Flashcard Review
                {practiceMode && (
                  <Badge className="bg-gradient-to-r from-primary/20 to-primary/10 text-primary border-primary/30">
                    Practice Mode
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {practiceMode 
                  ? "Reinforcing new words - First review scheduled for tomorrow"
                  : "Review your Italian vocabulary cards"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Enhanced Progress indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">Progress:</span>
              <span className="text-foreground font-semibold">{currentIndex + 1} / {totalInSession}</span>
            </div>
            <Badge variant="secondary" className="bg-mastered/10 text-mastered border-mastered/30">
              ✓ {reviewedCount} Reviewed
            </Badge>
          </div>
          
          {/* Progress Bar */}
          <div className="relative w-full h-2 bg-muted/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-mastered transition-all duration-500 ease-out"
              style={{ width: `${((currentIndex + 1) / totalInSession) * 100}%` }}
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {currentCard && (() => {
              const learningStep = currentCard.learning_step ?? 0;
              if (learningStep >= 0 && learningStep < 2) {
                return (
                  <Badge className="bg-learning/10 text-learning border-learning/30">
                    📚 Learning: Step {learningStep + 1}/2
                  </Badge>
                );
              } else if (learningStep === -1) {
                return (
                  <Badge className="bg-mastered/10 text-mastered border-mastered/30">
                    ✨ Review Phase
                  </Badge>
                );
              }
              return null;
            })()}
            {sessionQueue.length > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/30">
                ⏳ {sessionQueue.length} in queue
              </Badge>
            )}
          </div>
        </div>

        {/* Enhanced Flashcard */}
        <div 
          className="perspective-1000 cursor-pointer mb-8"
          onClick={!isFlipped ? handleFlip : undefined}
        >
          <div
            className={`relative w-full flip-card ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            style={{
              transformStyle: 'preserve-3d',
              minHeight: '350px',
            }}
          >
            {/* Front of card (Italian word) */}
            <Card
              className={`absolute w-full backface-hidden shadow-xl hover:shadow-2xl transition-shadow ${
                isFlipped ? 'invisible' : 'visible'
              } border-primary/20 bg-gradient-to-br from-card to-primary/5`}
              style={{ backfaceVisibility: 'hidden' }}
            >
              <CardContent className="flex flex-col items-center justify-center p-12 min-h-[350px]">
                <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-6">
                  <p className="text-xs font-medium text-primary uppercase tracking-wide">Italian Word</p>
                </div>
                <h2 className="text-6xl font-bold text-center mb-8 italian-text bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                  {currentCard?.word_original || currentCard?.word}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
                  <span>💡</span>
                  Click anywhere to reveal
                </p>
              </CardContent>
            </Card>

            {/* Back of card (English translation) */}
            <Card
              className={`absolute w-full backface-hidden shadow-xl ${
                isFlipped ? 'visible' : 'invisible'
              } border-mastered/20 bg-gradient-to-br from-card to-mastered/5`}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <CardContent className="flex flex-col items-center justify-center p-10 min-h-[350px]">
                <div className="text-center space-y-4 w-full">
                  <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30">
                    <p className="text-xs font-medium text-primary uppercase tracking-wide">Italian</p>
                  </div>
                  <h3 className="text-4xl font-bold italian-text text-foreground">
                    {currentCard?.word_original || currentCard?.word}
                  </h3>
                  
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-4 text-xs text-muted-foreground uppercase">Translation</span>
                    </div>
                  </div>
                  
                  <div className="inline-block px-4 py-1.5 rounded-full bg-mastered/10 border border-mastered/30">
                    <p className="text-xs font-medium text-mastered uppercase tracking-wide">English</p>
                  </div>
                  <p className="text-3xl font-semibold text-foreground">
                    {currentCard?.translation || 'Translation unavailable'}
                  </p>

                  {currentCard?.example_sentence && (
                    <div className="mt-6 p-5 bg-gradient-to-br from-muted/50 to-accent/30 rounded-xl border border-border/50">
                      <p className="text-xs font-medium text-primary mb-2 uppercase tracking-wide">Example Sentence</p>
                      <p className="italic text-base leading-relaxed italian-text text-foreground">{currentCard.example_sentence}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Review buttons */}
        {isFlipped && (() => {
          const isLearning = (currentCard?.learning_step ?? 0) >= 0 && (currentCard?.learning_step ?? 0) < 2;
          
          if (isLearning) {
            // Learning phase: Show 3 buttons
            return (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground font-medium">
                  How well did you know this word?
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={() => handleReview(1)}
                    disabled={isReviewing}
                    className="w-full relative h-28 btn-press bg-gradient-to-br from-due to-due/80 hover:from-due/90 hover:to-due/70 text-due-foreground shadow-lg hover:shadow-xl transition-all"
                  >
                    <span className="flex flex-col items-center w-full">
                      <span className="text-2xl mb-1">❌</span>
                      <span className="text-base font-bold">Again</span>
                      <span className="text-xs opacity-90 mt-1">Didn't know</span>
                      <span className="text-xs opacity-75 mt-1">← or 1</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleReview(4)}
                    disabled={isReviewing}
                    className="w-full h-28 btn-press bg-gradient-to-br from-learning to-learning/80 hover:from-learning/90 hover:to-learning/70 text-learning-foreground shadow-lg hover:shadow-xl transition-all border-2 border-learning/30"
                  >
                    <span className="flex flex-col items-center w-full">
                      <span className="text-2xl mb-1">👍</span>
                      <span className="text-base font-bold">Good</span>
                      <span className="text-xs opacity-90 mt-1">Knew it</span>
                      <span className="text-xs opacity-75 mt-1">↓ or 2</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleReview(5)}
                    disabled={isReviewing}
                    className="w-full h-28 btn-press bg-gradient-to-br from-mastered to-mastered/80 hover:from-mastered/90 hover:to-mastered/70 text-mastered-foreground shadow-lg hover:shadow-xl transition-all"
                  >
                    <span className="flex flex-col items-center w-full">
                      <span className="text-2xl mb-1">✨</span>
                      <span className="text-base font-bold">Easy</span>
                      <span className="text-xs opacity-90 mt-1">Very easy</span>
                      <span className="text-xs opacity-75 mt-1">→ or 3</span>
                    </span>
                  </Button>
                </div>
              </div>
            );
          } else {
            // Review phase: Show 2 buttons
            return (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground font-medium">
                  Did you remember this word?
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => handleReview(1)}
                    disabled={isReviewing}
                    className="w-full relative h-24 btn-press bg-gradient-to-br from-due to-due/80 hover:from-due/90 hover:to-due/70 text-due-foreground shadow-lg hover:shadow-xl transition-all"
                  >
                    <span className="flex flex-col items-center w-full">
                      <span className="text-3xl mb-2">❌</span>
                      <span className="text-lg font-bold">Again</span>
                      <span className="text-xs opacity-90 mt-1">Didn't remember</span>
                      <span className="text-xs opacity-75 mt-1">← or 1</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleReview(5)}
                    disabled={isReviewing}
                    className="w-full h-24 btn-press bg-gradient-to-br from-mastered to-mastered/80 hover:from-mastered/90 hover:to-mastered/70 text-mastered-foreground shadow-lg hover:shadow-xl transition-all"
                  >
                    <span className="flex flex-col items-center w-full">
                      <span className="text-3xl mb-2">✓</span>
                      <span className="text-lg font-bold">Correct</span>
                      <span className="text-xs opacity-90 mt-1">Knew it!</span>
                      <span className="text-xs opacity-75 mt-1">→ or Space</span>
                    </span>
                  </Button>
                </div>
              </div>
            );
          }
        })()}

        {!isFlipped && (
          <div className="flex flex-col items-center gap-3">
            <Button 
              onClick={handleFlip}
              className="btn-press px-8 py-6 text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
            >
              <span className="mr-2">👁️</span>
              Show Answer
            </Button>
            <p className="text-xs text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg">
              Press <kbd className="px-2 py-0.5 bg-background border border-border rounded">Space</kbd>, <kbd className="px-2 py-0.5 bg-background border border-border rounded">Enter</kbd>, or <kbd className="px-2 py-0.5 bg-background border border-border rounded">↓</kbd> to flip
            </p>
          </div>
        )}

        {/* Skip button */}
        <div className="flex justify-center mt-6 pt-4 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            End Review Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

