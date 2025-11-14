import { useState, useEffect } from 'react';
import { api } from '@/lib/serverComm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Lightbulb, Trophy, Target } from 'lucide-react';

interface Exercise {
  id?: string;
  type: string;
  question: string;
  correctAnswer: string;
  // Type-specific fields
  options?: string[];
  scrambledWords?: string[];
  errors?: Array<{ position: number; incorrect: string; correct: string }>;
  scenario?: string;
  dialogue?: Array<{ speaker: string; text: string }>;
  // Common fields
  explanation: string;
  hints?: string[];
  difficulty: string;
}

interface GrammarPracticeProps {
  conceptId: string;
  conceptName: string;
  onComplete: () => void;
  onClose: () => void;
}

export function GrammarPractice({ conceptId, conceptName, onComplete, onClose }: GrammarPracticeProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  
  // Adaptive practice session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [currentDifficulty, setCurrentDifficulty] = useState<string>('easy');
  const [batchesCompleted, setBatchesCompleted] = useState(0);
  const [loadingNextBatch, setLoadingNextBatch] = useState(false);
  const [difficultyChangeMessage, setDifficultyChangeMessage] = useState<string | null>(null);

  useEffect(() => {
    startSession();
  }, [conceptId]);

  const startSession = async () => {
    try {
      setLoading(true);
      const response = await api.startPracticeSession(conceptId);
      setSessionId(response.sessionId);
      setExercises(response.exercises || []);
      setTotalAttempted(response.session.totalAttempted);
      setTotalCorrect(response.session.totalCorrect);
      setCurrentDifficulty(response.session.currentDifficulty);
    } catch (error) {
      console.error('Error starting practice session:', error);
      alert('Failed to start practice session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadNextBatch = async () => {
    if (!sessionId) return;
    
    try {
      setLoadingNextBatch(true);
      const response = await api.getNextBatch(sessionId);
      
      // Add new exercises to the list
      setExercises(prev => [...prev, ...(response.exercises || [])]);
      setTotalAttempted(response.session.totalAttempted);
      setTotalCorrect(response.session.totalCorrect);
      setCurrentDifficulty(response.session.currentDifficulty);
      setBatchesCompleted(prev => prev + 1);
      
      // Show difficulty adjustment message if it happened
      if (response.difficultyAdjustment) {
        setDifficultyChangeMessage(response.difficultyAdjustment.reason);
        setTimeout(() => setDifficultyChangeMessage(null), 5000); // Clear after 5 seconds
      }
    } catch (error) {
      console.error('Error loading next batch:', error);
      alert('Failed to load more exercises. Please try again.');
    } finally {
      setLoadingNextBatch(false);
    }
  };

  const currentExercise = exercises[currentIndex];
  // Progress based on total exercises attempted in session
  const progress = exercises.length > 0 ? ((currentIndex + (showFeedback ? 1 : 0)) / exercises.length) * 100 : 0;

  const handleSubmit = async () => {
    if (!userAnswer.trim() || !currentExercise?.id) return;

    setSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    try {
      const response = await api.submitGrammarExercise(currentExercise.id, userAnswer, timeSpent);
      const evaluation = response.evaluation;

      setIsCorrect(evaluation.isCorrect);
      setFeedback(evaluation.feedback);
      setExplanation(evaluation.explanation);
      setShowFeedback(true);

      if (evaluation.isCorrect) {
        setCorrectCount(correctCount + 1);
      }
    } catch (error) {
      console.error('Error submitting exercise:', error);
      // Fallback: simple string comparison
      const correct = userAnswer.trim().toLowerCase() === currentExercise.correctAnswer.toLowerCase();
      setIsCorrect(correct);
      setFeedback(correct ? 'Correct!' : 'Not quite right.');
      setExplanation(currentExercise.explanation);
      setShowFeedback(true);
      if (correct) setCorrectCount(correctCount + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setShowFeedback(false);
      setShowHint(false);
      setCurrentHintIndex(0);
      setStartTime(Date.now());
      
      // Auto-load next batch when reaching the end of current batch
      const nextIndex = currentIndex + 1;
      if (nextIndex % 10 === 0 && nextIndex === exercises.length - 1 && !loadingNextBatch) {
        loadNextBatch();
      }
    } else {
      // Reached end of current exercises - load more or finish
      if (!loadingNextBatch) {
        loadNextBatch();
        setCurrentIndex(currentIndex + 1); // Move to next after current batch loads
      }
    }
  };
  
  const handleFinishSession = async () => {
    if (!sessionId) return;
    
    try {
      const response = await api.completePracticeSession(sessionId);
      
      // Show summary
      alert(`
Practice Session Complete! 🎉

Total Exercises: ${response.session.totalAttempted}
Correct: ${response.session.totalCorrect}
Score: ${((response.session.totalCorrect / response.session.totalAttempted) * 100).toFixed(0)}%

${response.session.summary || ''}

Great work! Keep practicing to improve.
      `);
      
      onComplete();
    } catch (error) {
      console.error('Error completing session:', error);
      onComplete(); // Still close even if summary fails
    }
  };

  const handleOptionSelect = (option: string) => {
    setUserAnswer(option);
  };

  const handleShowHint = () => {
    if (currentExercise?.hints && currentHintIndex < currentExercise.hints.length) {
      setShowHint(true);
      setCurrentHintIndex(currentHintIndex + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-medium">Generating exercises...</p>
        <p className="text-sm text-muted-foreground mt-1">Using AI to create personalized practice</p>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <XCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">No exercises available</p>
        <p className="text-sm text-muted-foreground mb-4">Unable to generate exercises for this concept.</p>
        <Button onClick={onClose}>Close</Button>
      </div>
    );
  }

  // Completion screen
  if (showFeedback && currentIndex === exercises.length - 1 && isCorrect) {
    const accuracy = (correctCount / exercises.length) * 100;
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Trophy className="h-20 w-20 text-primary mb-4 animate-bounce" />
        <h2 className="text-3xl font-bold mb-2">Practice Complete! 🎉</h2>
        <p className="text-xl mb-6">
          You got <span className="font-bold text-primary">{correctCount}</span> out of{' '}
          <span className="font-bold">{exercises.length}</span> correct
        </p>
        <div className="w-full max-w-md mb-6">
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div 
              className="h-3 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
              style={{ width: `${accuracy}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">{accuracy.toFixed(0)}% accuracy</p>
        </div>
        <div className="space-x-3">
          <Button onClick={() => {
            setCurrentIndex(0);
            setCorrectCount(0);
            setUserAnswer('');
            setShowFeedback(false);
            loadExercises();
          }}>
            Practice Again
          </Button>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Practicing: {conceptName}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Question {currentIndex + 1}
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleFinishSession}
              disabled={!sessionId || currentIndex === 0}
            >
              Finish Session
            </Button>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div 
            className="h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Difficulty Change Message */}
      {difficultyChangeMessage && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm font-medium text-primary">🎯 {difficultyChangeMessage}</p>
        </div>
      )}

      {/* Session Stats */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span>Session Score: {totalCorrect}/{totalAttempted || (currentIndex + (showFeedback ? 1 : 0))}</span>
        </div>
        <Badge className="bg-primary/10 text-primary capitalize">
          {currentDifficulty}
        </Badge>
        {batchesCompleted > 0 && (
          <Badge variant="outline">
            Batch {batchesCompleted + 1}
          </Badge>
        )}
      </div>

      {/* Exercise */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {currentExercise?.type === 'fill_blank' && '📝 Fill in the Blank'}
            {currentExercise?.type === 'multiple_choice' && '✓ Multiple Choice'}
            {currentExercise?.type === 'translation' && '🌐 Translation'}
            {currentExercise?.type === 'conjugation' && '🔄 Conjugation'}
            {currentExercise?.type === 'correction' && '✏️ Correction'}
            {currentExercise?.type === 'sentence_building' && '🏗️ Sentence Building'}
            {currentExercise?.type === 'error_spotting' && '🔍 Error Spotting'}
            {currentExercise?.type === 'contextual_usage' && '💬 Contextual Usage'}
            {currentExercise?.type === 'dialogue_completion' && '🗣️ Dialogue Completion'}
          </CardTitle>
          <CardDescription className="text-base leading-relaxed mt-2">
            {currentExercise?.scenario && (
              <div className="mb-3 p-3 bg-accent/30 rounded-md">
                <p className="text-sm font-medium mb-1">Scenario:</p>
                <p className="text-sm italic">{currentExercise.scenario}</p>
              </div>
            )}
            {currentExercise?.dialogue && currentExercise.type === 'dialogue_completion' ? (
              <div className="space-y-2">
                {currentExercise.dialogue.map((line, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="font-semibold text-primary">{line.speaker}:</span>
                    <span className={line.text === '___' ? 'italic text-muted-foreground' : ''}>
                      {line.text}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              currentExercise?.question
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Answer Input */}
          {!showFeedback && (
            <>
              {/* Multiple Choice */}
              {currentExercise?.type === 'multiple_choice' && currentExercise.options ? (
                <div className="space-y-2">
                  {currentExercise.options.map((option, idx) => (
                    <Button
                      key={idx}
                      variant={userAnswer === option ? 'default' : 'outline'}
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => handleOptionSelect(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              ) : currentExercise?.type === 'sentence_building' && currentExercise.scrambledWords ? (
                /* Sentence Building */
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Drag or type words to build the sentence:</p>
                    <div className="flex flex-wrap gap-2">
                      {currentExercise.scrambledWords.map((word, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20 transition-colors px-3 py-1"
                          onClick={() => setUserAnswer(userAnswer ? `${userAnswer} ${word}` : word)}
                        >
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Input
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Build your sentence here..."
                    className="text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && !submitting && userAnswer.trim() && handleSubmit()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUserAnswer('')}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                </div>
              ) : currentExercise?.type === 'error_spotting' ? (
                /* Error Spotting */
                <div className="space-y-3">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Find and correct the errors in this text:</p>
                    <p className="text-base leading-relaxed whitespace-pre-wrap">{currentExercise.question}</p>
                  </div>
                  <Input
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="List the errors you found (e.g., 'sono' should be 'è', ...)"
                    className="text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && !submitting && userAnswer.trim() && handleSubmit()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Identify the incorrect words and provide corrections
                  </p>
                </div>
              ) : (
                /* Standard Text Input (fill_blank, translation, conjugation, correction, contextual_usage, dialogue_completion) */
                <Input
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder={
                    currentExercise?.type === 'translation' ? 'Type the Italian translation...' :
                    currentExercise?.type === 'conjugation' ? 'Type the conjugated form...' :
                    currentExercise?.type === 'correction' ? 'Type the corrected sentence...' :
                    currentExercise?.type === 'contextual_usage' ? 'Type your response...' :
                    currentExercise?.type === 'dialogue_completion' ? 'Complete the dialogue...' :
                    'Type your answer in Italian...'
                  }
                  className="text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && !submitting && userAnswer.trim() && handleSubmit()}
                  autoFocus
                />
              )}

              {/* Hints */}
              {currentExercise?.hints && currentExercise.hints.length > 0 && (
                <div className="space-y-2">
                  {showHint && currentHintIndex > 0 && (
                    <div className="p-3 bg-primary/10 rounded-lg flex items-start gap-2">
                      <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{currentExercise.hints[currentHintIndex - 1]}</p>
                    </div>
                  )}
                  {currentHintIndex < currentExercise.hints.length && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShowHint}
                      className="text-muted-foreground"
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Show Hint ({currentHintIndex + 1}/{currentExercise.hints.length})
                    </Button>
                  )}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!userAnswer.trim() || submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? 'Checking...' : 'Submit Answer'}
              </Button>
            </>
          )}

          {/* Feedback */}
          {showFeedback && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  isCorrect ? 'bg-mastered/10 border border-mastered/30' : 'bg-due/10 border border-due/30'
                }`}
              >
                {isCorrect ? (
                  <CheckCircle2 className="h-6 w-6 text-mastered flex-shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-due flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-semibold mb-1">{isCorrect ? 'Correct!' : 'Not quite right'}</p>
                  <p className="text-sm">{feedback}</p>
                </div>
              </div>

              {!isCorrect && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Correct Answer:</p>
                  <p className="text-lg font-semibold italian-text">{currentExercise?.correctAnswer}</p>
                </div>
              )}

              <div className="p-4 bg-accent/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Explanation:</p>
                <p className="text-sm">{explanation}</p>
              </div>

              <Button onClick={handleNext} className="w-full" size="lg">
                {currentIndex < exercises.length - 1 ? 'Next Exercise' : 'See Results'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

