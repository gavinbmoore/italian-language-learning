import { useState, useEffect } from 'react';
import { api } from '@/lib/serverComm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, CheckCircle2, Lock, Clock } from 'lucide-react';
import { ReadingTask } from '@/components/reading-task';
import { Progress } from '@/components/ui/progress';

interface DailyTask {
  id: string;
  title: string;
  difficulty_level: string;
  is_completed: boolean;
  completed_at: Date | null;
  order_index: number;
}

interface ReadingStats {
  totalTextsCompleted: number;
  textsCompletedToday: number;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracyRate: number;
  currentStreak: number;
}

export function Reading() {
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadDailyTasks();
    loadStats();
  }, []);

  const loadDailyTasks = async () => {
    try {
      setLoading(true);
      const response = await api.getDailyReadingTasks();
      setDailyTasks(response.texts || []);
    } catch (error) {
      console.error('Error loading daily tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.getReadingStats();
      setStats(response.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleTaskComplete = () => {
    // Reload tasks and stats after completing a task
    loadDailyTasks();
    loadStats();
    setSelectedTaskId(null);
  };

  const handleTaskClose = () => {
    setSelectedTaskId(null);
  };

  if (selectedTaskId) {
    return (
      <ReadingTask
        textId={selectedTaskId}
        onComplete={handleTaskComplete}
        onClose={handleTaskClose}
      />
    );
  }

  const completedCount = dailyTasks.filter(t => t.is_completed).length;
  const progressPercentage = (completedCount / 3) * 100;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <BookOpen className="w-8 h-8" />
          Daily Reading Comprehension
        </h1>
        <p className="text-muted-foreground">
          Complete 3 reading tasks each day to improve your Italian comprehension
        </p>
      </div>

      {/* Progress Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Today's Progress</CardTitle>
          <CardDescription>
            {completedCount} of 3 tasks completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progressPercentage} className="h-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {completedCount}/3
                </div>
                <div className="text-sm text-muted-foreground">Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-mastered">
                  {stats?.currentStreak || 0}
                </div>
                <div className="text-sm text-muted-foreground">Day Streak</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-learning">
                  {stats?.totalTextsCompleted || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-due">
                  {stats ? Math.round(stats.accuracyRate * 100) : 0}%
                </div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Tasks */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold mb-4">Today's Reading Tasks</h2>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading reading tasks...</p>
          </div>
        ) : dailyTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Generating your daily tasks...</p>
              <p className="text-muted-foreground mb-4">
                This may take a moment. Please refresh the page.
              </p>
              <Button onClick={loadDailyTasks}>
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : (
          dailyTasks.map((task, index) => {
            const isLocked = index > 0 && !dailyTasks[index - 1].is_completed;
            
            return (
              <Card
                key={task.id}
                className={`transition-all ${
                  task.is_completed
                    ? 'bg-mastered/5 border-mastered/30'
                    : isLocked
                    ? 'opacity-60 bg-muted/20'
                    : 'hover:shadow-lg hover:border-primary/50'
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          Task {index + 1}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {task.difficulty_level}
                        </Badge>
                        {task.is_completed && (
                          <Badge className="bg-mastered text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {isLocked && (
                          <Badge variant="secondary">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{task.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      {task.is_completed
                        ? 'Great job! You completed this reading.'
                        : isLocked
                        ? 'Complete the previous task to unlock this one.'
                        : 'Click Start to begin reading and answer comprehension questions.'}
                    </p>
                    <Button
                      onClick={() => setSelectedTaskId(task.id)}
                      disabled={isLocked}
                      variant={task.is_completed ? 'outline' : 'default'}
                    >
                      {task.is_completed ? 'Review' : 'Start'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Completion Message */}
      {completedCount === 3 && (
        <Card className="mt-8 bg-gradient-to-r from-mastered/10 to-learning/10 border-mastered">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-mastered" />
            <h3 className="text-2xl font-bold mb-2">Congratulations! 🎉</h3>
            <p className="text-lg text-muted-foreground">
              You've completed all 3 reading tasks for today!
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Come back tomorrow for new reading challenges.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

