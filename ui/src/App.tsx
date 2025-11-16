import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from "@/components/theme-provider";
import { LoginForm } from '@/components/login-form';
import { Navbar } from '@/components/navbar';
import { AppSidebar } from '@/components/appSidebar';
import { Home } from '@/pages/Home';
import { Settings } from '@/pages/Settings';
import { Page1 } from '@/pages/Page1';
import { Page2 } from '@/pages/Page2';
import { ComprehensibleInputConversation } from '@/pages/ComprehensibleInput';
import { Grammar } from '@/pages/Grammar';
import { Reading } from '@/pages/Reading';
import { AnkiDecks } from '@/pages/AnkiDecks';
import { AnkiDeckStudy } from '@/pages/AnkiDeckStudy';
import { FlashcardReview } from '@/components/flashcard-review';
import { api } from '@/lib/serverComm';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

interface FlashcardData {
  id: string;
  word: string;
  word_original: string;
  translation: string | null;
  example_sentence: string | null;
  learning_step?: number | null;
}

function AppContent() {
  const { user, loading, profileLoading } = useAuth();
  const [showLoginForAnonymous, setShowLoginForAnonymous] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [dueCards, setDueCards] = useState<FlashcardData[]>([]);
  const [flashcardStats, setFlashcardStats] = useState<{ dueCount: number } | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState(false);

  // Reset login form state when user upgrades from anonymous to authenticated
  useEffect(() => {
    if (user && !user.isAnonymous) {
      setShowLoginForAnonymous(false);
    }
  }, [user?.isAnonymous]);

  // Check for due flashcards when user is authenticated
  useEffect(() => {
    if (user && !loading && !profileLoading) {
      checkForDueCards();
    }
  }, [user, loading, profileLoading]);

  const checkForDueCards = async () => {
    try {
      const response = await api.getDueFlashcards();
      if (response.cards && response.cards.length > 0) {
        setDueCards(response.cards);
        setShowFlashcards(true);
      }
      // Also update stats for badge
      const statsResponse = await api.getFlashcardStats();
      setFlashcardStats(statsResponse.stats);
    } catch (error) {
      console.error('Error checking for due cards:', error);
    }
  };

  const handleReviewCard = async (cardId: string, quality: number) => {
    try {
      await api.reviewFlashcard(cardId, quality);
    } catch (error) {
      console.error('Error reviewing card:', error);
      throw error;
    }
  };

  const handleFlashcardsComplete = async () => {
    // Refresh stats after completing review session
    try {
      const statsResponse = await api.getFlashcardStats();
      setFlashcardStats(statsResponse.stats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  };

  const handleOpenFlashcards = async (mode: 'due' | 'all' | 'hard' = 'due') => {
    try {
      let response;
      
      if (mode === 'due') {
        response = await api.getDueFlashcards();
      } else if (mode === 'hard') {
        response = await api.getHardFlashcards(20);
      } else {
        response = await api.getAllFlashcards(20);
      }
      
      if (response.cards && response.cards.length > 0) {
        setDueCards(response.cards);
        // Only 'all' mode is practice mode (no SRS updates)
        // 'due' and 'hard' modes should update SRS and use the learning queue
        setIsPracticeMode(mode === 'all');
        setShowFlashcards(true);
      } else {
        const modeText = mode === 'hard' ? 'hard cards' : 
                        mode === 'all' ? 'cards' : 'cards due';
        alert(`No ${modeText} available for review right now.`);
      }
    } catch (error) {
      console.error(`Error fetching ${mode} flashcards:`, error);
      alert('Failed to load flashcards. Please try again.');
    }
  };

  const handleTriggerPracticeReview = (cards: FlashcardData[]) => {
    setDueCards(cards);
    setIsPracticeMode(true);
    setShowFlashcards(true);
  };

  // Show loading while authentication or profile is loading
  if (loading || profileLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  // Determine if login form should be shown
  const allowAnonymous = import.meta.env.VITE_ALLOW_ANONYMOUS_USERS !== 'false';
  
  let shouldShowLogin: boolean;
  if (allowAnonymous) {
    // Anonymous users are allowed - never show login (anonymous auth happens automatically)
    shouldShowLogin = false;
  } else {
    // Anonymous users NOT allowed - show login if no user OR if user is anonymous
    // (force authentication with real credentials)
    shouldShowLogin = !user || user.isAnonymous;
  }

  const handleSignInClick = () => {
    setShowLoginForAnonymous(true);
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col w-full min-h-screen bg-background">
        <Navbar 
          onSignInClick={handleSignInClick} 
          flashcardDueCount={flashcardStats?.dueCount || 0}
          flashcardTotalCount={flashcardStats?.totalCards || 0}
          onOpenFlashcards={handleOpenFlashcards}
        />
        {shouldShowLogin ? (
          <main className="flex flex-col items-center justify-center flex-1 p-4">
            <LoginForm />
          </main>
        ) : (
          <div className="flex flex-1">
            <AppSidebar 
              flashcardDueCount={flashcardStats?.dueCount || 0}
              flashcardTotalCount={flashcardStats?.totalCards || 0}
              onOpenFlashcards={handleOpenFlashcards}
            />
            <SidebarInset className="flex-1">
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route 
                    path="/comprehensible-input" 
                    element={<ComprehensibleInputConversation onTriggerPracticeReview={handleTriggerPracticeReview} />} 
                  />
                  <Route path="/grammar" element={<Grammar onTriggerPracticeReview={handleTriggerPracticeReview} />} />
                  <Route path="/reading" element={<Reading />} />
                  <Route path="/anki-decks" element={<AnkiDecks />} />
                  <Route path="/anki-decks/:deckId/study" element={<AnkiDeckStudy />} />
                  <Route path="/page1" element={<Page1 />} />
                  <Route path="/page2" element={<Page2 />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </SidebarInset>
          </div>
        )}
        
        {/* Flashcard Review Modal */}
        <FlashcardReview
          open={showFlashcards}
          onOpenChange={setShowFlashcards}
          cards={dueCards}
          onReviewCard={handleReviewCard}
          onComplete={handleFlashcardsComplete}
          practiceMode={isPracticeMode}
        />
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        disableTransitionOnChange
        storageKey="volo-app-theme"
      >
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
