import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, MessageSquareWarning, ClipboardCheck } from 'lucide-react';
import { Button } from './ui/button';
import { supabase, projectId } from '../supabase/client';
import { showToast } from './utils/toast';

interface ApprovalPanelProps {
  roomId: string;
  onClose: () => void;
}

interface Approval {
  id: string;
  decision: 'approved' | 'changes_requested';
  comment: string;
  byUsername: string;
  createdAt: string;
}

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ roomId, onClose }) => {
  const [history, setHistory] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(roomId)}/approval`, { headers });
      if (!response.ok) throw new Error(`Failed to load approval history (${response.status})`);
      const data = await response.json();
      setHistory(data.approvals || []);
    } catch (error) {
      console.error('Failed to load approval history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, getAuthHeaders]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const submitDecision = async (decision: 'approved' | 'changes_requested') => {
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(roomId)}/approval`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision, comment }),
      });
      if (!response.ok) throw new Error(`Failed to submit (${response.status})`);
      showToast.success(decision === 'approved' ? 'Design approved' : 'Changes requested');
      setComment('');
      loadHistory();
    } catch (error) {
      console.error('Failed to submit approval decision:', error);
      showToast.error('Failed to submit decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const latest = history[0];

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Design Approval</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 shrink-0">
        {latest && (
          <div className={`text-xs px-3 py-2 rounded border ${
            latest.decision === 'approved' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            Current status: <span className="font-technical uppercase">{latest.decision === 'approved' ? 'Approved' : 'Changes Requested'}</span>
            {' '}by {latest.byUsername}
          </div>
        )}

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment..."
          rows={2}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" className="bg-green-600 hover:bg-green-500" disabled={isSubmitting} onClick={() => submitDecision('approved')}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" disabled={isSubmitting} onClick={() => submitDecision('changes_requested')}>
            <MessageSquareWarning className="w-3.5 h-3.5 mr-1" /> Request Changes
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 border-t border-gray-700 space-y-2">
        {isLoading && <div className="text-center text-gray-500 text-xs py-4">Loading history...</div>}
        {!isLoading && history.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-4">No approval history yet.</div>
        )}
        {!isLoading && history.map((a) => (
          <div key={a.id} className="text-xs p-2 rounded bg-slate-800/50 border border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className={a.decision === 'approved' ? 'text-green-400' : 'text-amber-400'}>
                {a.decision === 'approved' ? 'Approved' : 'Changes requested'}
              </span>
              <span className="text-gray-500 font-technical">{new Date(a.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="text-gray-400 mt-0.5">{a.byUsername}</div>
            {a.comment && <div className="text-gray-300 mt-1">{a.comment}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApprovalPanel;
