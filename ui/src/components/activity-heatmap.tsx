import { useState, useEffect } from 'react';
import { api } from '@/lib/serverComm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActivityDay {
  date: string;
  durationSeconds: number;
  flashcardReviews: number;
}

type ViewMode = 'week' | 'month' | 'year';

export function ActivityHeatmap() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivityData(viewMode);
  }, [viewMode]);

  const fetchActivityData = async (mode: ViewMode) => {
    try {
      setLoading(true);
      setError(null);
      
      const { startDate, endDate } = getDateRange(mode);
      const response = await api.getActivityData(
        formatDateForAPI(startDate),
        formatDateForAPI(endDate)
      );
      
      setActivityData(response.activity || []);
    } catch (err) {
      console.error('Error fetching activity data:', err);
      setError('Failed to load activity data');
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (mode: ViewMode): { startDate: Date; endDate: Date } => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (mode) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'year':
        startDate.setDate(endDate.getDate() - 365);
        break;
    }
    
    return { startDate, endDate };
  };

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return 'Less than a minute';
    }
  };

  const getIntensityClass = (durationSeconds: number): string => {
    const minutes = durationSeconds / 60;
    
    if (minutes === 0) {
      return 'bg-activity-0 border border-activity-0';
    } else if (minutes <= 15) {
      return 'bg-activity-1 border border-activity-1';
    } else if (minutes <= 30) {
      return 'bg-activity-2 border border-activity-2';
    } else if (minutes <= 60) {
      return 'bg-activity-3 border border-activity-3';
    } else {
      return 'bg-activity-4 border border-activity-4';
    }
  };

  const generateAllDays = (mode: ViewMode): string[] => {
    const { startDate, endDate } = getDateRange(mode);
    const days: string[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(formatDateForAPI(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getActivityForDay = (date: string): ActivityDay => {
    const activity = activityData.find(a => a.date === date);
    return activity || { date, durationSeconds: 0, flashcardReviews: 0 };
  };

  const renderHeatmap = () => {
    const allDays = generateAllDays(viewMode);
    const tileSize = viewMode === 'year' ? 'w-2 h-2' : viewMode === 'month' ? 'w-3 h-3' : 'w-5 h-5';
    const gap = viewMode === 'year' ? 'gap-0.5' : viewMode === 'month' ? 'gap-1' : 'gap-1.5';
    
    return (
      <div className={`flex flex-wrap ${gap} justify-start`}>
        {allDays.map((date) => {
          const activity = getActivityForDay(date);
          const intensityClass = getIntensityClass(activity.durationSeconds);
          
          return (
            <TooltipProvider key={date}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div
                    className={`${tileSize} ${intensityClass} rounded-md cursor-pointer hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-primary/50 transition-all duration-200`}
                  />
                </TooltipTrigger>
                <TooltipContent className="bg-card border-border shadow-xl">
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-foreground">{formatDateForDisplay(date)}</div>
                    {activity.durationSeconds > 0 ? (
                      <>
                        <div className="text-primary font-medium">{formatDuration(activity.durationSeconds)}</div>
                        {activity.flashcardReviews > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {activity.flashcardReviews} flashcard{activity.flashcardReviews !== 1 ? 's' : ''} reviewed
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground">No activity</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-6 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Activity</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const renderLegend = () => (
    <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
      <span className="font-medium">Activity Level:</span>
      <div className="flex items-center gap-2">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-activity-0 border border-activity-0 rounded-sm"></div>
          <div className="w-4 h-4 bg-activity-1 border border-activity-1 rounded-sm"></div>
          <div className="w-4 h-4 bg-activity-2 border border-activity-2 rounded-sm"></div>
          <div className="w-4 h-4 bg-activity-3 border border-activity-3 rounded-sm"></div>
          <div className="w-4 h-4 bg-activity-4 border border-activity-4 rounded-sm"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 border rounded-xl bg-card shadow-sm card-lift">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Study Activity</h2>
      </div>
      
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
        <TabsList className="mb-6">
          <TabsTrigger value="week" className="px-6">Week</TabsTrigger>
          <TabsTrigger value="month" className="px-6">Month</TabsTrigger>
          <TabsTrigger value="year" className="px-6">Year</TabsTrigger>
        </TabsList>
        
        <TabsContent value="week" className="mt-0">
          <div className="animate-fade-in">
            {renderHeatmap()}
            {renderLegend()}
          </div>
        </TabsContent>
        
        <TabsContent value="month" className="mt-0">
          <div className="animate-fade-in">
            {renderHeatmap()}
            {renderLegend()}
          </div>
        </TabsContent>
        
        <TabsContent value="year" className="mt-0">
          <div className="animate-fade-in">
            {renderHeatmap()}
            {renderLegend()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

