import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/serverComm';
import { useAuth } from '@/lib/auth-context';

interface LearningTimerHook {
  isActive: boolean;
  elapsedSeconds: number;
  totalTimeToday: number;
  formattedTime: string;
  startTimer: (pageContext?: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  refreshTotalTime: () => Promise<void>;
}

const ACTIVITY_TIMEOUT = 30000; // 30 seconds of inactivity before pausing
const SAVE_INTERVAL = 30000; // Save progress every 30 seconds
const IDLE_CHECK_INTERVAL = 5000; // Check for idle every 5 seconds

export function useLearningTimer(pageContext: string = 'general'): LearningTimerHook {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalTimeToday, setTotalTimeToday] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const lastActivityRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // Track user activity
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);
  
  // Load total time for today
  const refreshTotalTime = useCallback(async () => {
    if (!user) return;
    
    try {
      const data = await api.getTotalLearningTime(1); // Last 1 day
      setTotalTimeToday(data.totalSeconds || 0);
    } catch (error) {
      console.error('Failed to load total time:', error);
    }
  }, [user]);
  
  // Start the timer
  const startTimer = useCallback(async (context?: string) => {
    if (!user) {
      console.error('Cannot start timer: No user logged in');
      alert('Please sign in to use the learning timer.');
      return;
    }
    if (isActive) return;
    
    try {
      const response = await api.startLearningSession(context || pageContext);
      const newSessionId = response.session.sessionId;
      
      setSessionId(newSessionId);
      setIsActive(true);
      startTimeRef.current = Date.now();
      lastActivityRef.current = Date.now();
      
      // Start the timer interval (update every second)
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
      
      // Start the save interval (save every 30 seconds)
      saveIntervalRef.current = setInterval(async () => {
        if (newSessionId) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          try {
            await api.updateLearningSession(newSessionId, elapsed);
          } catch (error) {
            console.error('Failed to save session progress:', error);
          }
        }
      }, SAVE_INTERVAL);
      
      // Start idle check interval
      idleCheckIntervalRef.current = setInterval(() => {
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        if (timeSinceActivity > ACTIVITY_TIMEOUT && isActive) {
          // User is idle, pause the timer
          console.log('User idle, pausing timer');
          stopTimer();
        }
      }, IDLE_CHECK_INTERVAL);
      
    } catch (error) {
      console.error('Failed to start timer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to start timer: ${errorMessage}\n\nPlease check:\n1. Backend server is running (port 5500)\n2. You are signed in\n3. Check browser console for details`);
    }
  }, [user, isActive, pageContext]);
  
  // Stop the timer
  const stopTimer = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      // Clear all intervals
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
      
      // Save final time and end session
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      await api.updateLearningSession(sessionId, elapsed);
      await api.endLearningSession(sessionId);
      
      setIsActive(false);
      setSessionId(null);
      setElapsedSeconds(0);
      
      // Refresh total time
      await refreshTotalTime();
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  }, [sessionId, refreshTotalTime]);
  
  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        // Tab is hidden, stop the timer
        stopTimer();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, stopTimer]);
  
  // Track user activity events
  useEffect(() => {
    if (!isActive) return;
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isActive, handleActivity]);
  
  // Load total time on mount
  useEffect(() => {
    if (user) {
      refreshTotalTime();
    }
  }, [user, refreshTotalTime]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActive && sessionId) {
        // Save and end session on unmount
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api.updateLearningSession(sessionId, elapsed).then(() => {
          return api.endLearningSession(sessionId);
        }).catch(error => {
          console.error('Failed to end session on unmount:', error);
        });
      }
    };
  }, []); // Only run on unmount
  
  return {
    isActive,
    elapsedSeconds,
    totalTimeToday,
    formattedTime: formatTime(elapsedSeconds),
    startTimer,
    stopTimer,
    refreshTotalTime,
  };
}

