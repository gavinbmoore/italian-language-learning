import { useState, useEffect } from 'react';
import { api } from '@/lib/serverComm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { BookOpen, AlertCircle, Target, TrendingUp, Award, Brain, ChevronRight } from 'lucide-react';
import { ConversationalGrammarPractice } from '@/components/conversational-grammar-practice';
import { GrammarLearningPath } from '@/components/grammar-learning-path';
import { GrammarRulesRenderer } from '@/components/grammar-rules-renderer';

interface RuleBlock {
  type: 'heading' | 'paragraph' | 'list' | 'note' | 'table';
  content: string | string[] | { headers: string[]; rows: string[][] };
  level?: number;
  variant?: 'info' | 'warning' | 'tip';
  ordered?: boolean;
}

interface GrammarConcept {
  id: string;
  name: string;
  name_italian: string;
  category: string;
  cefr_level: string;
  description: string;
  rules?: string | RuleBlock[]; // Comprehensive explanation (string for legacy, RuleBlock[] for structured)
  examples: Array<{ italian: string; english: string; highlight?: string }>;
  common_mistakes: Array<{ wrong: string; correct: string; explanation: string }>;
  practice_focus?: string[]; // Key practice areas
  importance: number;
}

interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  channelName: string;
  duration?: string;
}

interface WeakConcept {
  concept: GrammarConcept;
  errorCount: number;
  lastErrorDate: Date | null;
  masteryLevel: string;
}

interface GrammarStats {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByCategory: Record<string, number>;
  weakConceptsCount: number;
  recentErrorRate: number;
}

interface FlashcardData {
  id: string;
  word: string;
  word_original: string;
  translation: string | null;
  example_sentence: string | null;
}

interface GrammarProps {
  onTriggerPracticeReview?: (cards: FlashcardData[]) => void;
}

interface MasteryStats {
  dueCount: number;
  totalConcepts: number;
  newConcepts: number;
  learningConcepts: number;
  practicingConcepts: number;
  masteredConcepts: number;
  weakConcepts: number;
}

interface VideoAnalysis {
  coreLessons: string[];
  examples: Array<{
    italian: string;
    english: string;
    explanation: string;
  }>;
  keyTakeaways: string[];
  practiceRecommendations: string[];
}

interface LearningPathData {
  learningPath: Array<{
    level: string;
    concepts: any[];
    completedCount: number;
    totalCount: number;
  }>;
  statistics: {
    totalConcepts: number;
    completedConcepts: number;
    completionPercentage: number;
    inProgress: number;
    notStarted: number;
  };
}

export function Grammar({ onTriggerPracticeReview }: GrammarProps = {}) {
  const { user, loading: authLoading } = useAuth();
  const [concepts, setConcepts] = useState<GrammarConcept[]>([]);
  const [weakAreas, setWeakAreas] = useState<WeakConcept[]>([]);
  const [stats, setStats] = useState<GrammarStats | null>(null);
  const [masteryStats, setMasteryStats] = useState<MasteryStats | null>(null);
  const [learningPathData, setLearningPathData] = useState<LearningPathData | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<GrammarConcept | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isPracticing, setIsPracticing] = useState(false);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [showVideos, setShowVideos] = useState(true);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [markingWatched, setMarkingWatched] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedLevel, selectedCategory]);

  // Fetch videos when a concept is selected
  useEffect(() => {
    if (selectedConcept) {
      loadVideos(selectedConcept.id);
    } else {
      setVideos([]);
      setSelectedVideo(null);
      setShowVideos(true);
    }
  }, [selectedConcept]);

  // Check watched status and load analysis when video is selected
  useEffect(() => {
    if (selectedVideo && selectedConcept) {
      checkVideoWatchedStatus(selectedVideo.videoId);
      loadVideoAnalysis(selectedVideo.videoId);
    } else {
      setVideoWatched(false);
      setVideoAnalysis(null);
    }
  }, [selectedVideo, selectedConcept]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load learning path (includes all concepts with progress)
      const learningPath = await api.getGrammarLearningPath();
      setLearningPathData(learningPath);
      
      // Load grammar concepts
      const conceptsData = await api.getGrammarConcepts(
        selectedLevel !== 'all' ? selectedLevel : undefined,
        selectedCategory !== 'all' ? selectedCategory : undefined
      );
      // Filter out the sub-concepts for -IRE verbs (they're accessed through the main concept)
      const filteredConcepts = (conceptsData.concepts || []).filter(
        (c: GrammarConcept) => c.id !== 'a1-verb-conjugation-ire-regular' && c.id !== 'a1-verb-conjugation-ire-isc'
      );
      setConcepts(filteredConcepts);
      
      // Load weak areas
      const weakData = await api.getWeakGrammarAreas();
      setWeakAreas(weakData.weakConcepts || []);
      
      // Load statistics
      const statsData = await api.getGrammarStats();
      setStats(statsData.stats);
      
      // Load mastery stats
      const masteryData = await api.getGrammarMasteryStats();
      setMasteryStats(masteryData.stats);
      
    } catch (error) {
      console.error('Error loading grammar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async (conceptId: string) => {
    try {
      setLoadingVideos(true);
      const response = await api.getGrammarVideos(conceptId);
      setVideos(response.videos || []);
    } catch (error) {
      console.error('Error loading YouTube videos:', error);
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const checkVideoWatchedStatus = async (videoId: string) => {
    try {
      const response = await api.getVideoWatchedStatus(videoId);
      console.log('Video watched status:', videoId, response.watched);
      setVideoWatched(response.watched || false);
    } catch (error) {
      console.error('Error checking watched status:', error);
      setVideoWatched(false);
    }
  };

  const loadVideoAnalysis = async (videoId: string) => {
    try {
      setLoadingAnalysis(true);
      const response = await api.getGrammarVideoAnalysis(videoId, selectedConcept?.id);
      if (response.analysis) {
        setVideoAnalysis(response.analysis);
      } else {
        setVideoAnalysis(null);
      }
    } catch (error) {
      console.error('Error loading video analysis:', error);
      setVideoAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleMarkAsWatched = async () => {
    if (!selectedVideo || !selectedConcept) return;
    
    try {
      setMarkingWatched(true);
      await api.markGrammarVideoWatched(
        selectedVideo.videoId,
        selectedConcept.id,
        selectedVideo.title,
        selectedVideo.duration
      );
      setVideoWatched(true);
      
      // Poll for analysis (it's generated in background)
      setTimeout(() => {
        loadVideoAnalysis(selectedVideo.videoId);
      }, 2000); // Check after 2 seconds
      
      setTimeout(() => {
        loadVideoAnalysis(selectedVideo.videoId);
      }, 5000); // Check again after 5 seconds
    } catch (error) {
      console.error('Error marking video as watched:', error);
      alert('Failed to mark video as watched. Please try again.');
    } finally {
      setMarkingWatched(false);
    }
  };

  const getMasteryColor = (level: string) => {
    switch (level) {
      case 'mastered': return 'bg-mastered';
      case 'practicing': return 'bg-learning';
      case 'learning': return 'bg-due';
      case 'new': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      verbs: '🔄',
      articles: '📝',
      prepositions: '🔗',
      pronouns: '👤',
      adjectives: '✨',
      nouns: '📦',
      syntax: '🏗️',
      other: '📚',
    };
    return icons[category] || '📚';
  };

  const handleStartPractice = () => {
    setIsPracticing(true);
  };

  const handlePracticeComplete = async () => {
    // Reload data to reflect new progress
    await loadData();
    setIsPracticing(false);
  };

  const handleClosePractice = () => {
    setIsPracticing(false);
  };

  const handleAddToReview = async () => {
    if (!selectedConcept) return;
    try {
      await api.initializeGrammarConcept(selectedConcept.id);
      alert('Added to review queue! You\'ll see this concept in your spaced repetition reviews.');
      await loadData(); // Reload stats
    } catch (error) {
      console.error('Error adding to review queue:', error);
      alert('Failed to add to review queue. Please try again.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading grammar system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl animate-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Italian Grammar</h1>
        </div>
        <p className="text-muted-foreground">
          Master Italian grammar through AI-powered analysis and personalized practice
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="card-lift border-learning/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Curriculum Progress</p>
                <p className="text-2xl font-bold">{learningPathData?.statistics.completionPercentage || 0}%</p>
              </div>
              <BookOpen className="h-8 w-8 text-learning" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-lift border-mastered/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{learningPathData?.statistics.completedConcepts || 0}</p>
              </div>
              <Award className="h-8 w-8 text-mastered" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-lift border-due/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{learningPathData?.statistics.inProgress || 0}</p>
              </div>
              <Target className="h-8 w-8 text-due" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-lift border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Not Started</p>
                <p className="text-2xl font-bold">{learningPathData?.statistics.notStarted || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="learning-path" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="learning-path">Learning Path</TabsTrigger>
          <TabsTrigger value="browse">Browse Topics</TabsTrigger>
          <TabsTrigger value="weak-areas">Your Weak Areas</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        {/* Learning Path Tab */}
        <TabsContent value="learning-path" className="space-y-4">
          {learningPathData ? (
            <GrammarLearningPath
              learningPath={learningPathData.learningPath}
              statistics={learningPathData.statistics}
              onConceptClick={(concept) => setSelectedConcept(concept)}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading learning path...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Browse Topics Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4 flex-wrap">
                <div>
                  <label className="text-sm font-medium mb-2 block">CEFR Level</label>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Levels</option>
                    <option value="A1">A1 - Beginner</option>
                    <option value="A2">A2 - Elementary</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                    <option value="C1">C1 - Advanced</option>
                    <option value="C2">C2 - Proficient</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Categories</option>
                    <option value="verbs">Verbs</option>
                    <option value="articles">Articles</option>
                    <option value="prepositions">Prepositions</option>
                    <option value="pronouns">Pronouns</option>
                    <option value="adjectives">Adjectives</option>
                    <option value="nouns">Nouns</option>
                    <option value="syntax">Syntax</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grammar Concepts List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {concepts.map((concept) => (
              <Card
                key={concept.id}
                className="card-lift cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => setSelectedConcept(concept)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span>{getCategoryIcon(concept.category)}</span>
                        {concept.name}
                      </CardTitle>
                      <CardDescription className="mt-1 italic">
                        {concept.name_italian}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {concept.cefr_level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {concept.description}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full"
                  >
                    View Details <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Weak Areas Tab */}
        <TabsContent value="weak-areas" className="space-y-4">
          {weakAreas.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="h-12 w-12 text-mastered mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Great job!</h3>
                <p className="text-muted-foreground">
                  You haven't made any grammar errors yet. Keep up the excellent work!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {weakAreas.map((weak, idx) => (
                <Card key={idx} className="card-lift">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getCategoryIcon(weak.concept.category)}</span>
                          <div>
                            <h4 className="font-semibold">{weak.concept.name}</h4>
                            <p className="text-sm text-muted-foreground italic">
                              {weak.concept.name_italian}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-due">
                            {weak.errorCount} error{weak.errorCount !== 1 ? 's' : ''}
                          </Badge>
                          <Badge className={getMasteryColor(weak.masteryLevel)}>
                            {weak.masteryLevel}
                          </Badge>
                          <Badge variant="outline">{weak.concept.cefr_level}</Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => setSelectedConcept(weak.concept)}
                        size="sm"
                      >
                        Practice
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mastery Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Mastery Progress</CardTitle>
                <CardDescription>Your learning journey</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">New</span>
                      <span className="text-sm font-medium">{masteryStats?.newConcepts || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-muted h-2 rounded-full"
                        style={{
                          width: `${((masteryStats?.newConcepts || 0) / (masteryStats?.totalConcepts || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Learning</span>
                      <span className="text-sm font-medium">{masteryStats?.learningConcepts || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-due h-2 rounded-full"
                        style={{
                          width: `${((masteryStats?.learningConcepts || 0) / (masteryStats?.totalConcepts || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Practicing</span>
                      <span className="text-sm font-medium">{masteryStats?.practicingConcepts || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-learning h-2 rounded-full"
                        style={{
                          width: `${((masteryStats?.practicingConcepts || 0) / (masteryStats?.totalConcepts || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Mastered</span>
                      <span className="text-sm font-medium">{masteryStats?.masteredConcepts || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-mastered h-2 rounded-full"
                        style={{
                          width: `${((masteryStats?.masteredConcepts || 0) / (masteryStats?.totalConcepts || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Error Analysis</CardTitle>
                <CardDescription>Areas needing attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Errors</span>
                    <span className="font-semibold">{stats?.totalErrors || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Concepts with Errors</span>
                    <span className="font-semibold">{stats?.weakConceptsCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Recent Error Rate</span>
                    <span className="font-semibold">
                      {stats?.recentErrorRate?.toFixed(1) || 0} / conversation
                    </span>
                  </div>
                </div>

                {stats && Object.keys(stats.errorsByCategory).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Errors by Category</p>
                    <div className="space-y-2">
                      {Object.entries(stats.errorsByCategory)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([category, count]) => (
                          <div key={category} className="flex justify-between text-sm">
                            <span className="capitalize">{category}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Concept Detail Modal */}
      {selectedConcept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{selectedConcept.name}</CardTitle>
                  <CardDescription className="text-lg italic mt-1">
                    {selectedConcept.name_italian}
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSelectedConcept(null);
                    setIsPracticing(false);
                  }}
                >
                  ✕
                </Button>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge>{selectedConcept.cefr_level}</Badge>
                <Badge variant="outline">{selectedConcept.category}</Badge>
                
                {/* Completion status badges */}
                {(selectedConcept as any).isComplete && (
                  <Badge className="bg-mastered text-white border-mastered">
                    ✓ Concept Complete
                  </Badge>
                )}
                {(selectedConcept as any).hasWatchedVideo && (
                  <Badge variant="outline" className="bg-mastered/10 text-mastered border-mastered">
                    ✓ Video Watched
                  </Badge>
                )}
                {(selectedConcept as any).exercisesCompleted >= 5 && (
                  <Badge variant="outline" className="bg-mastered/10 text-mastered border-mastered">
                    ✓ 5 Exercises Done
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isPracticing ? (
                <>
                  {/* Action Buttons - Moved to Top */}
                  {selectedConcept.id === 'a1-verb-conjugation-ire' ? (
                    <>
                      <div className="mb-4">
                        <h4 className="font-semibold mb-3 text-sm">Choose Practice Type:</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <Button 
                            className="w-full justify-start h-auto py-4 px-4" 
                            variant="outline"
                            onClick={() => {
                              // Load the regular-only concept and start practice
                              api.getGrammarConcept('a1-verb-conjugation-ire-regular').then(data => {
                                setSelectedConcept(data.concept);
                                handleStartPractice();
                              });
                            }}
                          >
                            <div className="text-left w-full">
                              <div className="font-semibold">Regular Pattern Only</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Practice: dormire, partire, sentire (no -isc-)
                              </div>
                            </div>
                          </Button>
                          <Button 
                            className="w-full justify-start h-auto py-4 px-4" 
                            variant="outline"
                            onClick={() => {
                              // Load the -isc- concept and start practice
                              api.getGrammarConcept('a1-verb-conjugation-ire-isc').then(data => {
                                setSelectedConcept(data.concept);
                                handleStartPractice();
                              });
                            }}
                          >
                            <div className="text-left w-full">
                              <div className="font-semibold">With -isc- Pattern</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Practice: finire, capire, preferire (with -isc-)
                              </div>
                            </div>
                          </Button>
                          <Button 
                            className="w-full justify-start h-auto py-4 px-4"
                            onClick={handleStartPractice}
                          >
                            <div className="text-left w-full">
                              <div className="font-semibold">Mixed Practice</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Practice both patterns together (recommended after mastering each separately)
                              </div>
                            </div>
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={handleAddToReview}>
                          Add to Review Queue
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-3">
                      <Button className="flex-1" onClick={handleStartPractice}>
                        Start Practice
                      </Button>
                      <Button variant="outline" onClick={handleAddToReview}>
                        Add to Review Queue
                      </Button>
                    </div>
                  )}

                  {/* What's needed to complete */}
                  {!(selectedConcept as any).isComplete && (
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <h4 className="font-semibold mb-2 text-sm">To Complete This Concept:</h4>
                      <div className="space-y-1 text-sm">
                        {!(selectedConcept as any).hasWatchedVideo && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-due">○</span>
                            Watch a video tutorial
                          </div>
                        )}
                        {(selectedConcept as any).exercisesCompleted < 5 && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-due">○</span>
                            Complete {5 - ((selectedConcept as any).exercisesCompleted || 0)} more exercise{5 - ((selectedConcept as any).exercisesCompleted || 0) !== 1 ? 's' : ''} ({(selectedConcept as any).exercisesCompleted || 0}/5 done)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-muted-foreground">{selectedConcept.description}</p>
                  </div>

                  {/* Comprehensive Rules Section */}
                  {selectedConcept.rules && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Grammar Rules
                      </h4>
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <GrammarRulesRenderer rules={selectedConcept.rules} />
                      </div>
                    </div>
                  )}

                  {/* Video Tutorials Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Video Tutorials</h4>
                      {videos.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowVideos(!showVideos)}
                        >
                          {showVideos ? 'Hide' : 'Show'}
                        </Button>
                      )}
                    </div>
                    
                    {showVideos && (
                      <>
                        {loadingVideos ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : videos.length > 0 ? (
                          <div className="space-y-4">
                            {/* Selected Video Player */}
                            {selectedVideo && (
                              <div className="mb-4">
                                <div className="relative w-full pt-[56.25%] bg-black rounded-lg overflow-hidden">
                                  <iframe
                                    className="absolute inset-0 w-full h-full"
                                    src={`https://www.youtube.com/embed/${selectedVideo.videoId}`}
                                    title={selectedVideo.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                                <div className="mt-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-sm">{selectedVideo.title}</h5>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {selectedVideo.channelName}
                                        {selectedVideo.duration && ` • ${selectedVideo.duration}`}
                                      </p>
                                    </div>
                                    {videoWatched && (
                                      <Badge variant="outline" className="ml-2 bg-mastered/10 text-mastered border-mastered">
                                        ✓ Watched
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedVideo(null)}
                                  >
                                    Show all videos
                                  </Button>
                                  {!videoWatched ? (
                                    <Button
                                      size="sm"
                                      onClick={handleMarkAsWatched}
                                      disabled={markingWatched}
                                      className="bg-primary"
                                    >
                                      {markingWatched ? 'Marking...' : 'Mark as Watched'}
                                    </Button>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">
                                      Debug: videoWatched is true
                                    </div>
                                  )}
                                </div>

                                {/* Lesson Analysis Section */}
                                {videoWatched && (
                                  <div className="mt-4 p-4 bg-accent/30 rounded-lg border border-primary/20">
                                    <h5 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                      <BookOpen className="h-4 w-4 text-primary" />
                                      Lesson Summary
                                    </h5>
                                    
                                    {loadingAnalysis ? (
                                      <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                        <span className="ml-2 text-sm text-muted-foreground">Analyzing video...</span>
                                      </div>
                                    ) : videoAnalysis ? (
                                      <div className="space-y-4">
                                        {/* Core Lessons */}
                                        {videoAnalysis.coreLessons && videoAnalysis.coreLessons.length > 0 && (
                                          <div>
                                            <h6 className="font-medium text-xs uppercase text-muted-foreground mb-2">Core Lessons</h6>
                                            <ul className="space-y-1.5">
                                              {videoAnalysis.coreLessons.map((lesson, idx) => (
                                                <li key={idx} className="text-sm flex items-start gap-2">
                                                  <span className="text-primary mt-0.5">•</span>
                                                  <span>{lesson}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Examples */}
                                        {videoAnalysis.examples && videoAnalysis.examples.length > 0 && (
                                          <div>
                                            <h6 className="font-medium text-xs uppercase text-muted-foreground mb-2">Examples</h6>
                                            <div className="space-y-2">
                                              {videoAnalysis.examples.map((example, idx) => (
                                                <div key={idx} className="p-2 bg-background/50 rounded border border-border/50">
                                                  <p className="font-medium text-sm italic">{example.italian}</p>
                                                  <p className="text-xs text-muted-foreground mt-0.5">{example.english}</p>
                                                  {example.explanation && (
                                                    <p className="text-xs text-muted-foreground mt-1 border-t border-border/30 pt-1">
                                                      {example.explanation}
                                                    </p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Key Takeaways */}
                                        {videoAnalysis.keyTakeaways && videoAnalysis.keyTakeaways.length > 0 && (
                                          <div>
                                            <h6 className="font-medium text-xs uppercase text-muted-foreground mb-2">Key Takeaways</h6>
                                            <ul className="space-y-1.5">
                                              {videoAnalysis.keyTakeaways.map((takeaway, idx) => (
                                                <li key={idx} className="text-sm flex items-start gap-2">
                                                  <span className="text-mastered mt-0.5">✓</span>
                                                  <span>{takeaway}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Practice Recommendations */}
                                        {videoAnalysis.practiceRecommendations && videoAnalysis.practiceRecommendations.length > 0 && (
                                          <div>
                                            <h6 className="font-medium text-xs uppercase text-muted-foreground mb-2">Practice Recommendations</h6>
                                            <ul className="space-y-1.5">
                                              {videoAnalysis.practiceRecommendations.map((rec, idx) => (
                                                <li key={idx} className="text-sm flex items-start gap-2">
                                                  <span className="text-due mt-0.5">→</span>
                                                  <span>{rec}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        Analysis is being generated. This may take a few moments...
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Video Grid */}
                            {!selectedVideo && (
                              <div className="grid grid-cols-1 gap-3">
                                {videos.map((video) => (
                                  <div
                                    key={video.videoId}
                                    className="flex gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                                  >
                                    <div 
                                      className="relative flex-shrink-0 w-32 h-20 bg-muted rounded overflow-hidden cursor-pointer"
                                      onClick={() => setSelectedVideo(video)}
                                    >
                                      <img
                                        src={video.thumbnail}
                                        alt={video.title}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors">
                                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                                          <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M4 3l8 5-8 5V3z"/>
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                      <div onClick={() => setSelectedVideo(video)} className="cursor-pointer">
                                        <h5 className="font-medium text-sm line-clamp-2">{video.title}</h5>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {video.channelName}
                                          {video.duration && ` • ${video.duration}`}
                                        </p>
                                      </div>
                                      <div className="flex gap-2 mt-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedVideo(video);
                                            setTimeout(() => {
                                              handleMarkAsWatched();
                                            }, 100);
                                          }}
                                        >
                                          Mark Watched
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            <p>No video tutorials found for this concept.</p>
                            <p className="text-xs mt-1">Check back later or search YouTube directly.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {selectedConcept.examples && selectedConcept.examples.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Examples</h4>
                      <div className="space-y-2">
                        {selectedConcept.examples.map((example, idx) => (
                          <div key={idx} className="p-3 bg-accent/50 rounded-lg">
                            <p className="font-medium italian-text">{example.italian}</p>
                            <p className="text-sm text-muted-foreground mt-1">{example.english}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedConcept.common_mistakes && selectedConcept.common_mistakes.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-due" />
                        Common Mistakes & Pitfalls
                      </h4>
                      <div className="space-y-3">
                        {selectedConcept.common_mistakes.map((mistake, idx) => (
                          <div key={idx} className="p-4 bg-due/10 rounded-lg border border-due/20">
                            <div className="flex items-start gap-2 mb-1">
                              <span className="text-due flex-shrink-0">❌</span>
                              <span className="font-medium line-through flex-1">{mistake.wrong}</span>
                            </div>
                            <div className="flex items-start gap-2 mb-2">
                              <span className="text-mastered flex-shrink-0">✓</span>
                              <span className="font-medium text-mastered flex-1">{mistake.correct}</span>
                            </div>
                            <p className="text-sm text-muted-foreground ml-6 leading-relaxed">{mistake.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Practice Focus Section */}
                  {selectedConcept.practice_focus && selectedConcept.practice_focus.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Practice Focus
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedConcept.practice_focus.map((focus, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="px-3 py-1 bg-primary/10 text-primary border border-primary/20"
                          >
                            {focus}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">
                        Focus on these key areas during practice to master this concept.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <ConversationalGrammarPractice
                  conceptId={selectedConcept.id}
                  conceptName={selectedConcept.name}
                  onComplete={handlePracticeComplete}
                  onClose={handleClosePractice}
                  onTriggerPracticeReview={onTriggerPracticeReview}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

