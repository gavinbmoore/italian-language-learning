/**
 * Anki Card Review Component
 * Similar to flashcard-review but with support for:
 * - HTML content rendering
 * - Images and audio
 * - Cloze deletions
 */

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
import { AnkiCardContent } from './anki-card-content';

export interface AnkiCardData {
  cardId: string;
  noteId: string;
  cardType: 'basic' | 'basic_reverse' | 'cloze';
  frontContent: string;
  backContent: string;
  frontAudio: string[];
  backAudio: string[];
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
  learning_step: number | null;
  state: string;
  modelName: string;
  tags: string[];
}

interface QueuedCard {
  card: AnkiCardData;
  showAfter: number;
}

interface AnkiCardReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: AnkiCardData[];
  onReviewCard: (cardId: string, quality: number) => Promise<any>;
  onComplete: () => void;
  deckId: string;
}

export function AnkiCardReview({
  open,
  onOpenChange,
  cards,
  onReviewCard,
  onComplete,
  deckId,
}: AnkiCardReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<QueuedCard[]>([]);
  const [allCards, setAllCards] = useState<AnkiCardData[]>([]);

  const currentCard = allCards[currentIndex];
  const totalCards = cards.length;
  const totalInSession = allCards.length;

  // Reset state when dialog opens/closes or cards change
  useEffect(() => {
    if (open && cards.length > 0) {
      setAllCards([...cards]);
      setSessionQueue([]);
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsReviewing(false);
      setReviewedCount(0);
      setShowCompletion(false);
    }
  }, [open, cards]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open || isReviewing || showCompletion) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
      }

      if (!isFlipped && (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        handleFlip();
        return;
      }

      if (isFlipped) {
        const isLearning = (currentCard?.learning_step ?? 0) >= 0 && (currentCard?.learning_step ?? 0) < 2;
        
        switch (event.key) {
          case 'ArrowLeft':
          case '1':
            handleReview(1);
            break;
          case '2':
          case 'ArrowDown':
            if (isLearning) {
              handleReview(4);
            }
            break;
          case 'ArrowRight':
          case ' ':
          case '3':
            if (isLearning) {
              handleReview(5);
            } else {
              handleReview(5);
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
      const result = await onReviewCard(currentCard.cardId, quality);
      
      const newReviewedCount = reviewedCount + 1;
      setReviewedCount(newReviewedCount);

      // Check if card should stay in session (learning phase)
      if (result && result.result && result.result.in_session) {
        const showAfter = currentIndex + 3;
        const updatedCard = { ...currentCard, learning_step: result.result.learning_step };
        setSessionQueue(prev => [...prev, { card: updatedCard, showAfter }]);
      }

      // Get next card from queue or advance
      const nextQueuedCard = sessionQueue.find(q => q.showAfter <= currentIndex + 1);
      
      if (nextQueuedCard) {
        setSessionQueue(prev => prev.filter(q => q.card.cardId !== nextQueuedCard.card.cardId));
        setAllCards(prev => {
          const newCards = [...prev];
          newCards.splice(currentIndex + 1, 0, nextQueuedCard.card);
          return newCards;
        });
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else if (currentIndex + 1 >= allCards.length) {
        if (sessionQueue.length > 0) {
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
            <DialogTitle>No Cards to Study</DialogTitle>
            <DialogDescription>
              You don't have any cards due for review right now.
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
            <div className="text-8xl mb-6 animate-bounce">🎉</div>
            <DialogHeader>
              <DialogTitle className="text-3xl mb-2 bg-gradient-to-r from-mastered to-primary bg-clip-text text-transparent">
                Excellent Work!
              </DialogTitle>
              <DialogDescription className="text-lg">
                You've reviewed all {totalCards} card{totalCards !== 1 ? 's' : ''}! 🌟
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-mastered/10 to-primary/10 border border-mastered/30">
              <p className="text-base font-medium">
                Keep building that knowledge! 💪
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto glass-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl">Anki Card Review</DialogTitle>
              <DialogDescription className="mt-1">
                Study your imported flashcards
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress */}
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
          
          <div className="relative w-full h-2 bg-muted/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-mastered transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / totalInSession) * 100}%` }}
            />
          </div>
          
          {/* Tags */}
          {currentCard && currentCard.tags && currentCard.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {currentCard.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Flashcard */}
        <div 
          className="perspective-1000 cursor-pointer mb-6"
          onClick={!isFlipped ? handleFlip : undefined}
        >
          <div
            className={`relative w-full flip-card ${isFlipped ? 'rotate-y-180' : ''}`}
            style={{
              transformStyle: 'preserve-3d',
              minHeight: '400px',
            }}
          >
            {/* Front */}
            <Card
              className={`absolute w-full backface-hidden shadow-xl hover:shadow-2xl transition-shadow ${
                isFlipped ? 'invisible' : 'visible'
              } border-primary/20 bg-gradient-to-br from-card to-primary/5`}
              style={{ backfaceVisibility: 'hidden' }}
            >
              <CardContent className="p-8 min-h-[400px]">
                <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-6">
                  <p className="text-xs font-medium text-primary uppercase">Question</p>
                </div>
                <AnkiCardContent
                  html={currentCard?.frontContent || ''}
                  audioFiles={currentCard?.frontAudio || []}
                  className="text-lg"
                  deckId={deckId}
                />
                <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                  <p className="text-sm text-muted-foreground flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
                    <span>💡</span>
                    Click anywhere to reveal
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Back */}
            <Card
              className={`absolute w-full backface-hidden shadow-xl ${
                isFlipped ? 'visible' : 'invisible'
              } border-mastered/20 bg-gradient-to-br from-card to-mastered/5`}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <CardContent className="p-8 min-h-[400px]">
                <div className="inline-block px-4 py-1.5 rounded-full bg-mastered/10 border border-mastered/30 mb-6">
                  <p className="text-xs font-medium text-mastered uppercase">Answer</p>
                </div>
                <AnkiCardContent
                  html={currentCard?.backContent || ''}
                  audioFiles={currentCard?.backAudio || []}
                  className="text-lg"
                  deckId={deckId}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Review buttons */}
        {isFlipped && (() => {
          const isLearning = (currentCard?.learning_step ?? 0) >= 0 && (currentCard?.learning_step ?? 0) < 2;
          
          if (isLearning) {
            return (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground font-medium">
                  How well did you know this?
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={() => handleReview(1)}
                    disabled={isReviewing}
                    className="w-full h-24 btn-press bg-gradient-to-br from-due to-due/80"
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-2xl mb-1">❌</span>
                      <span className="text-base font-bold">Again</span>
                      <span className="text-xs opacity-90">← or 1</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleReview(4)}
                    disabled={isReviewing}
                    className="w-full h-24 btn-press bg-gradient-to-br from-learning to-learning/80"
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-2xl mb-1">👍</span>
                      <span className="text-base font-bold">Good</span>
                      <span className="text-xs opacity-90">↓ or 2</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleReview(5)}
                    disabled={isReviewing}
                    className="w-full h-24 btn-press bg-gradient-to-br from-mastered to-mastered/80"
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-2xl mb-1">✨</span>
                      <span className="text-base font-bold">Easy</span>
                      <span className="text-xs opacity-90">→ or 3</span>
                    </span>
                  </Button>
                </div>
              </div>
            );
          } else {
            return (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground font-medium">
                  Did you remember this?
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => handleReview(1)}
                    disabled={isReviewing}
                    className="w-full h-24 btn-press bg-gradient-to-br from-due to-due/80"
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-3xl mb-2">❌</span>
                      <span className="text-lg font-bold">Again</span>
                      <span className="text-xs opacity-90">← or 1</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleReview(5)}
                    disabled={isReviewing}
                    className="w-full h-24 btn-press bg-gradient-to-br from-mastered to-mastered/80"
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-3xl mb-2">✓</span>
                      <span className="text-lg font-bold">Correct</span>
                      <span className="text-xs opacity-90">→ or Space</span>
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
              className="btn-press px-8 py-6 text-base bg-gradient-to-r from-primary to-primary/80"
            >
              <span className="mr-2">👁️</span>
              Show Answer
            </Button>
          </div>
        )}

        {/* End session button */}
        <div className="flex justify-center pt-4 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            End Review Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

