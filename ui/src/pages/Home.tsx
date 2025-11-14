import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { ActivityHeatmap } from '@/components/activity-heatmap';
import { LearnedWordsStats } from '@/components/learned-words-stats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Layers, BookOpen, Flame, Target, Clock } from 'lucide-react';
import { api } from '@/lib/serverComm';

const italianQuotes = [
  {
    italian: "Chi va piano, va sano e va lontano.",
    english: "Who goes slowly, goes safely and goes far.",
  },
  {
    italian: "L'appetito vien mangiando.",
    english: "Appetite comes with eating.",
  },
  {
    italian: "Non è mai troppo tardi per imparare.",
    english: "It's never too late to learn.",
  },
  {
    italian: "La pratica rende perfetti.",
    english: "Practice makes perfect.",
  },
  {
    italian: "Goccia a goccia si scava la pietra.",
    english: "Drop by drop, the stone is carved.",
  },
];

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proficiency, setProficiency] = useState<any>(null);
  const [flashcardStats, setFlashcardStats] = useState<any>(null);
  const [todaysQuote] = useState(() => {
    const today = new Date().getDate();
    return italianQuotes[today % italianQuotes.length];
  });
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Buongiorno');
    } else if (hour < 18) {
      setGreeting('Buon pomeriggio');
    } else {
      setGreeting('Buonasera');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profData, flashData] = await Promise.all([
        api.getProficiency().catch(() => null),
        api.getFlashcardStats().catch(() => null),
      ]);
      
      if (profData) setProficiency(profData.proficiency);
      if (flashData) setFlashcardStats(flashData.stats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const userName = user?.displayName?.split(' ')[0] || 'there';

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="animate-in">
          <div className="glass-card rounded-2xl p-8 md:p-12 overflow-hidden relative">
            {/* Subtle background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 -z-10" />
            
            <div className="space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="space-y-2">
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    <span className="italian-text text-primary">{greeting}</span>, {userName}!
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    Continue your Italian learning journey. You're making great progress!
                  </p>
                </div>
                
                {proficiency && (
                  <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Current Level</p>
                        <p className="text-2xl font-bold text-primary">{proficiency.level}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Daily Quote */}
              <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-accent/20 to-primary/10 border border-primary/20">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-lg italic font-medium italian-text text-foreground">
                      "{todaysQuote.italian}"
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {todaysQuote.english}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="animate-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="card-lift cursor-pointer hover:border-primary/50 transition-all group" onClick={() => navigate('/comprehensible-input')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-colors">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Start Learning</CardTitle>
                    <CardDescription>Practice with AI conversation</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {proficiency && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{proficiency.vocabulary_size} words learned</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-lift cursor-pointer hover:border-due/50 transition-all group" onClick={() => navigate('/comprehensible-input')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-due/20 to-due/10 group-hover:from-due/30 group-hover:to-due/20 transition-colors">
                    <Layers className="h-6 w-6 text-due" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Review Flashcards</CardTitle>
                    <CardDescription>Reinforce your vocabulary</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {flashcardStats && (
                  <div className="flex items-center gap-2 text-sm">
                    {flashcardStats.dueCount > 0 ? (
                      <>
                        <Flame className="h-4 w-4 text-due" />
                        <span className="text-due font-medium">{flashcardStats.dueCount} cards due</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">All caught up! 🎉</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-lift border-mastered/30 bg-gradient-to-br from-mastered/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-mastered/20 to-mastered/10">
                    <Target className="h-6 w-6 text-mastered" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Daily Goal</CardTitle>
                    <CardDescription>Keep your streak going</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Today's progress</span>
                    <span className="font-medium text-mastered">On track</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats Section */}
        <div className="animate-in" style={{ animationDelay: '0.2s' }}>
          <LearnedWordsStats />
        </div>

        {/* Activity Heatmap */}
        <div className="animate-in" style={{ animationDelay: '0.3s' }}>
          <ActivityHeatmap />
        </div>
      </div>
    </div>
  );
} 