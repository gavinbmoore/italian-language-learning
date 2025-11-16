/**
 * Anki Deck Study Page
 * Shows deck statistics and starts study sessions
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/serverComm';
import { AnkiCardReview, type AnkiCardData } from '@/components/anki-card-review';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Loader2, BookOpen } from 'lucide-react';

export function AnkiDeckStudy() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  
  const [deck, setDeck] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [studyCards, setStudyCards] = useState<AnkiCardData[]>([]);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (deckId) {
      loadDeck();
    }
  }, [deckId]);

  const loadDeck = async () => {
    try {
      setLoading(true);
      const response = await api.getAnkiDeck(deckId!);
      setDeck(response.deck);
    } catch (error) {
      console.error('Error loading deck:', error);
      alert('Failed to load deck');
      navigate('/anki-decks');
    } finally {
      setLoading(false);
    }
  };

  const handleStartStudy = async () => {
    try {
      setLoading(true);
      const response = await api.getAnkiStudyCards(deckId!, 20, 50);
      
      if (response.cards.length === 0) {
        alert('No cards to study right now. Great job!');
        return;
      }
      
      setStudyCards(response.cards);
      setShowReview(true);
    } catch (error) {
      console.error('Error loading study cards:', error);
      alert('Failed to load study cards');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewCard = async (cardId: string, quality: number) => {
    try {
      const result = await api.reviewAnkiCard(deckId!, cardId, quality);
      return result;
    } catch (error) {
      console.error('Error reviewing card:', error);
      throw error;
    }
  };

  const handleComplete = async () => {
    // Reload deck stats after completing study session
    await loadDeck();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Deck not found</p>
            <Button className="mt-4" onClick={() => navigate('/anki-decks')}>
              Back to Decks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = deck.stats;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/anki-decks')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Decks
      </Button>

      {/* Deck Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{deck.name}</h1>
        {deck.description && (
          <p className="text-muted-foreground">{deck.description}</p>
        )}
      </div>

      {/* Statistics Card */}
      <Card className="glass-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Deck Statistics
          </CardTitle>
          <CardDescription>
            Track your progress through this deck
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{stats.totalCards}</div>
              <div className="text-sm text-muted-foreground">Total Cards</div>
            </div>
            
            <div className="p-4 rounded-lg bg-due/10 border border-due/30">
              <div className="text-2xl font-bold text-due">{stats.dueCards}</div>
              <div className="text-sm text-muted-foreground">Due for Review</div>
            </div>
            
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-2xl font-bold text-primary">{stats.newCards}</div>
              <div className="text-sm text-muted-foreground">New Cards</div>
            </div>
            
            <div className="p-4 rounded-lg bg-learning/10 border border-learning/30">
              <div className="text-2xl font-bold text-learning">{stats.learningCards}</div>
              <div className="text-sm text-muted-foreground">Learning</div>
            </div>
            
            <div className="p-4 rounded-lg bg-mastered/10 border border-mastered/30">
              <div className="text-2xl font-bold text-mastered">{stats.masteredCards}</div>
              <div className="text-sm text-muted-foreground">Mastered</div>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{stats.reviewCards}</div>
              <div className="text-sm text-muted-foreground">In Review</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Study Actions */}
      <Card className="glass-card">
        <CardContent className="p-8">
          <div className="text-center">
            {stats.dueCards > 0 || stats.newCards > 0 ? (
              <>
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">Ready to Study</h3>
                  <p className="text-muted-foreground">
                    {stats.dueCards > 0 && (
                      <span className="text-due font-semibold">{stats.dueCards} cards due</span>
                    )}
                    {stats.dueCards > 0 && stats.newCards > 0 && ' and '}
                    {stats.newCards > 0 && (
                      <span className="text-primary font-semibold">{stats.newCards} new cards</span>
                    )}
                    {' '}to learn
                  </p>
                </div>
                
                <Button
                  size="lg"
                  onClick={handleStartStudy}
                  className="btn-press px-12 py-6 text-lg bg-gradient-to-r from-primary to-primary/80"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Start Studying
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground mb-6">
                  You've reviewed all cards in this deck. Great work!
                </p>
                <p className="text-sm text-muted-foreground">
                  Come back later when more cards are due for review.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Component */}
      <AnkiCardReview
        open={showReview}
        onOpenChange={setShowReview}
        cards={studyCards}
        onReviewCard={handleReviewCard}
        onComplete={handleComplete}
        deckId={deckId!}
      />
    </div>
  );
}

