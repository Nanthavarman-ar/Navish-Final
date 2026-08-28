import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { apiCall } from '../../hooks/useApi';
import {
  Box,
  Users,
  HardDrive,
  Eye,
  Activity,
  AlertTriangle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface Stats {
  totalModels: number;
  totalClients: number;
  totalUsers: number;
  storageUsed: string;
  storageBytes: number;
  totalViews: number;
  recentActivity: number;
  errorCount: number;
  warningCount: number;
}

// GET /make-server-cf230d31/stats already computes all of this server-side (server/index.tsx)
// from real KV data - this page was the only thing missing, the backend has been sitting
// unused with no caller anywhere in the app.
export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiCall('/stats');
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const tiles: Array<{ label: string; value: string | number; icon: typeof Box; accent: string }> = stats
    ? [
        { label: 'Total Models', value: stats.totalModels, icon: Box, accent: 'text-cyan-400' },
        { label: 'Total Clients', value: stats.totalClients, icon: Users, accent: 'text-cyan-400' },
        { label: 'Total Users', value: stats.totalUsers, icon: Users, accent: 'text-blue-400' },
        { label: 'Storage Used', value: stats.storageUsed, icon: HardDrive, accent: 'text-purple-400' },
        { label: 'Total Views', value: stats.totalViews, icon: Eye, accent: 'text-emerald-400' },
        { label: 'Activity (24h)', value: stats.recentActivity, icon: Activity, accent: 'text-amber-400' },
        { label: 'Errors', value: stats.errorCount, icon: AlertTriangle, accent: stats.errorCount > 0 ? 'text-red-400' : 'text-gray-500' },
        { label: 'Warnings', value: stats.warningCount, icon: AlertCircle, accent: stats.warningCount > 0 ? 'text-yellow-400' : 'text-gray-500' }
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-semibold">Overview</h2>
          <p className="text-gray-400 text-sm">Platform-wide stats at a glance</p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading && !stats && (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
          Loading stats...
        </div>
      )}

      {error && !isLoading && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-6 text-red-300 text-sm">{error}</CardContent>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tiles.map(({ label, value, icon: Icon, accent }) => (
            <Card key={label} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-gray-400 text-sm font-medium">
                  {label}
                  <Icon className={`w-4 h-4 ${accent}`} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${accent}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
