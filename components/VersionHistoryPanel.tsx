import React, { useState, useEffect, useCallback } from 'react';
import { X, History, RotateCcw, User, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { supabase, projectId } from '../supabase/client';
import { showToast } from './utils/toast';

interface VersionHistoryPanelProps {
  roomId: string;
  onClose: () => void;
  onRestored?: () => void;
}

interface SceneVersion {
  version: number;
  lastModified: string;
  lastModifiedByUsername?: string;
  thumbnail?: string;
}

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ roomId, onClose, onRestored }) => {
  const [versions, setVersions] = useState<SceneVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not signed in');

      const response = await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(roomId)}/versions`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error(`Failed to load version history (${response.status})`);

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load scene versions:', err);
      setError('Could not load version history');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleRestore = async (version: number) => {
    setRestoringVersion(version);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not signed in');

      const response = await fetch(
        `${functionsBaseUrl}/api/scenes/${encodeURIComponent(roomId)}/versions/${version}/restore`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!response.ok) throw new Error(`Restore failed (${response.status})`);

      showToast.success('Scene restored', 'Reload the model to see the restored version');
      onRestored?.();
      loadVersions(); // refresh - the previous current state is now itself a version
    } catch (err) {
      console.error('Failed to restore version:', err);
      showToast.error('Failed to restore this version');
    } finally {
      setRestoringVersion(null);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 w-96 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Version History</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close version history"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
            Loading history...
          </div>
        )}

        {!isLoading && error && (
          <div className="text-center py-8 text-red-400 text-sm">{error}</div>
        )}

        {!isLoading && !error && versions.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No earlier versions yet.
            <br />
            <span className="text-gray-500">A version is saved automatically each time you save the scene.</span>
          </div>
        )}

        {!isLoading && !error && versions.map((v) => (
          <div
            key={v.version}
            className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/80 rounded-lg hover:border-cyan-500/40 transition-colors"
          >
            {v.thumbnail ? (
              <img src={v.thumbnail} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded bg-slate-700 flex items-center justify-center shrink-0">
                <History className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-xs text-gray-300">
                <Clock className="w-3 h-3" />
                <span className="font-technical">{new Date(v.lastModified).toLocaleString()}</span>
              </div>
              {v.lastModifiedByUsername && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  <User className="w-3 h-3" />
                  {v.lastModifiedByUsername}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-8 px-2"
              disabled={restoringVersion !== null}
              onClick={() => handleRestore(v.version)}
              title="Restore this version"
            >
              {restoringVersion === v.version ? (
                <div className="animate-spin w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
