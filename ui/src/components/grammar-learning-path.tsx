import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Play, BookOpen, Dumbbell } from 'lucide-react';

interface GrammarConcept {
  id: string;
  name: string;
  name_italian: string;
  category: string;
  cefr_level: string;
  description: string;
  importance: number;
  isComplete: boolean;
  hasWatchedVideo: boolean;
  exercisesCompleted: number;
  needsVideo: boolean;
  needsExercises: boolean;
  progress: {
    masteryLevel: string;
    totalExercisesCompleted: number;
    correctExercises: number;
    errorCount: number;
    hasWatchedVideo: boolean;
    completedAt: Date | null;
    lastReviewed: Date | null;
  } | null;
}

interface LevelGroup {
  level: string;
  concepts: GrammarConcept[];
  completedCount: number;
  totalCount: number;
}

interface Statistics {
  totalConcepts: number;
  completedConcepts: number;
  completionPercentage: number;
  inProgress: number;
  notStarted: number;
}

interface GrammarLearningPathProps {
  learningPath: LevelGroup[];
  statistics: Statistics;
  onConceptClick: (concept: GrammarConcept) => void;
}

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: 'Beginner - Basic phrases and expressions',
  A2: 'Elementary - Simple everyday situations',
  B1: 'Intermediate - Familiar matters and interests',
  B2: 'Upper Intermediate - Complex texts and ideas',
  C1: 'Advanced - Flexible and effective language use',
  C2: 'Proficient - Mastery of the language',
};

const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-blue-500',
  A2: 'bg-green-500',
  B1: 'bg-yellow-500',
  B2: 'bg-orange-500',
  C1: 'bg-red-500',
  C2: 'bg-purple-500',
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

export function GrammarLearningPath({ learningPath, statistics, onConceptClick }: GrammarLearningPathProps) {
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set(['A1', 'A2']));

  const toggleLevel = (level: string) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Your Grammar Learning Journey
          </CardTitle>
          <CardDescription>
            Progress through Italian grammar from A1 to C2
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">
                {statistics.completedConcepts} of {statistics.totalConcepts} concepts complete
              </span>
            </div>
            <Progress value={statistics.completionPercentage} className="h-3" />
            <div className="text-right text-lg font-bold text-primary">
              {statistics.completionPercentage}%
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-mastered">{statistics.completedConcepts}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-learning">{statistics.inProgress}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">{statistics.notStarted}</div>
              <div className="text-xs text-muted-foreground">Not Started</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Groups */}
      <div className="space-y-4">
        {learningPath.map((levelGroup) => {
          const isExpanded = expandedLevels.has(levelGroup.level);
          const progressPercentage = levelGroup.totalCount > 0 
            ? (levelGroup.completedCount / levelGroup.totalCount) * 100 
            : 0;
          const levelColor = LEVEL_COLORS[levelGroup.level] || 'bg-gray-500';

          return (
            <Card key={levelGroup.level} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleLevel(levelGroup.level)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className={`w-2 h-2 rounded-full ${levelColor}`} />
                    <div>
                      <CardTitle className="text-xl">
                        Level {levelGroup.level}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {LEVEL_DESCRIPTIONS[levelGroup.level]}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {levelGroup.completedCount} / {levelGroup.totalCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(progressPercentage)}% complete
                    </div>
                  </div>
                </div>

                {/* Progress bar for the level */}
                <div className="mt-3">
                  <Progress value={progressPercentage} className="h-1.5" />
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {levelGroup.concepts.map((concept) => (
                      <Card
                        key={concept.id}
                        className={`card-lift cursor-pointer hover:border-primary/50 transition-all relative ${
                          concept.isComplete ? 'border-mastered/50 bg-mastered/5' : ''
                        }`}
                        onClick={() => onConceptClick(concept)}
                      >
                        {/* Completion indicator */}
                        {concept.isComplete && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="h-6 w-6 text-mastered" />
                          </div>
                        )}

                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-2 pr-8">
                            <span className="text-xl mt-0.5">{getCategoryIcon(concept.category)}</span>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base leading-tight">
                                {concept.name}
                              </CardTitle>
                              <CardDescription className="text-sm italic mt-1">
                                {concept.name_italian}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0 space-y-2">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {concept.description}
                          </p>

                          {/* Progress indicators */}
                          <div className="flex gap-2 flex-wrap pt-2">
                            {concept.hasWatchedVideo ? (
                              <Badge variant="outline" className="text-xs bg-mastered/10 text-mastered border-mastered">
                                <Play className="h-3 w-3 mr-1" />
                                Video ✓
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <Play className="h-3 w-3 mr-1" />
                                Video
                              </Badge>
                            )}

                            {concept.exercisesCompleted >= 5 ? (
                              <Badge variant="outline" className="text-xs bg-mastered/10 text-mastered border-mastered">
                                <Dumbbell className="h-3 w-3 mr-1" />
                                Exercises ✓
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <Dumbbell className="h-3 w-3 mr-1" />
                                {concept.exercisesCompleted}/5
                              </Badge>
                            )}
                          </div>

                          {!concept.isComplete && (concept.hasWatchedVideo || concept.exercisesCompleted > 0) && (
                            <div className="text-xs text-muted-foreground pt-1">
                              {concept.needsVideo && '📹 Watch video'}
                              {concept.needsVideo && concept.needsExercises && ' • '}
                              {concept.needsExercises && `💪 ${5 - concept.exercisesCompleted} more exercise${5 - concept.exercisesCompleted !== 1 ? 's' : ''}`}
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 text-xs"
                          >
                            {concept.isComplete ? 'Review Concept' : 'Start Learning'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Motivational message */}
      {statistics.completionPercentage === 100 && (
        <Card className="border-mastered/50 bg-mastered/5">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-xl font-bold text-mastered mb-2">
              Congratulations!
            </h3>
            <p className="text-muted-foreground">
              You've completed the entire Italian grammar curriculum from A1 to C2!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

