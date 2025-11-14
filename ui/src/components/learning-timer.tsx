import { useEffect } from 'react';
import { useLearningTimer } from '@/hooks/use-learning-timer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LearningTimerProps {
  pageContext?: string;
  autoStart?: boolean;
  variant?: 'full' | 'compact' | 'minimal';
  className?: string;
}

export function LearningTimer({ 
  pageContext = 'general', 
  autoStart = false,
  variant = 'full',
  className = '' 
}: LearningTimerProps) {
  const { isActive, totalTimeToday, formattedTime, startTimer, stopTimer } = useLearningTimer(pageContext);
  
  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !isActive) {
      startTimer(pageContext);
    }
    
    // Cleanup: stop timer when component unmounts
    return () => {
      if (isActive) {
        stopTimer();
      }
    };
  }, [autoStart]); // Only run on mount
  
  const formatTotalTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  
  // Minimal variant - just a badge in the navbar
  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={isActive ? 'default' : 'secondary'} 
              className={`flex items-center gap-1 cursor-pointer ${className}`}
              onClick={() => isActive ? stopTimer() : startTimer(pageContext)}
            >
              <Clock className="w-3 h-3" />
              {formattedTime}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-semibold">Session: {formattedTime}</p>
              <p className="text-muted-foreground">Today: {formatTotalTime(totalTimeToday)}</p>
              <p className="text-xs mt-1">
                {isActive ? 'Click to pause' : 'Click to start'}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Compact variant - inline display
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          size="sm"
          variant={isActive ? 'default' : 'outline'}
          onClick={() => isActive ? stopTimer() : startTimer(pageContext)}
          className="flex items-center gap-1"
        >
          {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {formattedTime}
        </Button>
        <span className="text-sm text-muted-foreground">
          Today: {formatTotalTime(totalTimeToday)}
        </span>
      </div>
    );
  }
  
  // Full variant - card display
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${isActive ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
              <div>
                <div className="text-2xl font-bold font-mono">{formattedTime}</div>
                <div className="text-xs text-muted-foreground">Session Time</div>
              </div>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <div className="text-lg font-semibold">{formatTotalTime(totalTimeToday)}</div>
              <div className="text-xs text-muted-foreground">Today's Total</div>
            </div>
          </div>
          <Button
            size="lg"
            variant={isActive ? 'destructive' : 'default'}
            onClick={() => isActive ? stopTimer() : startTimer(pageContext)}
            className="flex items-center gap-2"
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Learning
              </>
            )}
          </Button>
        </div>
        {isActive && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }} />
            </div>
            <Badge variant="outline" className="text-xs">
              Active
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

