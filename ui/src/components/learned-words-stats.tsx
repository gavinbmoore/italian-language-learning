import { useState, useEffect } from 'react';
import { api } from '@/lib/serverComm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar, TrendingUp } from 'lucide-react';

interface LearnedWordsStats {
  allTime: number;
  thisMonth: number;
  thisWeek: number;
}

export function LearnedWordsStats() {
  const [stats, setStats] = useState<LearnedWordsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getLearnedWordsStats();
      setStats(response.stats);
    } catch (err) {
      console.error('Error fetching learned words stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-6 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Words Learned</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">Words Learned</h2>
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Vocabulary Progress</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* All Time Stats */}
        <Card className="card-lift overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-mastered/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">All Time</CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-mastered/20 to-mastered/10">
              <Trophy className="h-5 w-5 text-mastered" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-br from-mastered to-mastered/70 bg-clip-text text-transparent">
              {stats?.allTime ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total words mastered
            </p>
          </CardContent>
        </Card>

        {/* This Month Stats */}
        <Card className="card-lift overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
              {stats?.thisMonth ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Words learned this month
            </p>
          </CardContent>
        </Card>

        {/* This Week Stats */}
        <Card className="card-lift overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-learning/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-learning/20 to-learning/10">
              <TrendingUp className="h-5 w-5 text-learning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-br from-learning to-learning/70 bg-clip-text text-transparent">
              {stats?.thisWeek ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Words learned this week
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

