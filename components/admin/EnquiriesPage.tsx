import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { apiCall } from '../../hooks/useApi';
import { showToast } from '../utils/toast';
import { Mail, Phone, RefreshCw, Archive, Check, Inbox } from 'lucide-react';

type Status = 'new' | 'replied' | 'archived';

interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  projectType?: string;
  message: string;
  status: Status;
  createdAt: string;
}

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_STYLE: Record<Status, string> = {
  new: 'bg-red-500/20 text-red-300 border border-red-400/40',
  replied: 'bg-green-500/20 text-green-300 border border-green-400/40',
  archived: 'bg-slate-600/40 text-gray-400 border border-slate-500/40',
};

// Contact-form enquiries from the public site (see POST /public/contact on the server).
export function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/admin/enquiries');
      setEnquiries(data.enquiries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enquiries');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: Status) => {
    try {
      await apiCall(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setEnquiries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    } catch (err) {
      console.error('Failed to update enquiry:', err);
      showToast.error('Could not update the enquiry', 'Please try again');
    }
  };

  const shown = filter === 'open' ? enquiries.filter((e) => e.status !== 'archived') : enquiries;
  const newCount = enquiries.filter((e) => e.status === 'new').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex border border-slate-600 rounded-lg overflow-hidden" role="group" aria-label="Filter enquiries">
          {(['open', 'all'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'ghost'}
              className="rounded-none"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'open' ? `Open${newCount ? ` (${newCount} new)` : ''}` : 'All'}
            </Button>
          ))}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading && enquiries.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
          Loading enquiries...
        </div>
      )}

      {error && !isLoading && (
        <div className="text-center py-8">
          <div className="text-white text-lg mb-2">Couldn't load enquiries</div>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <Button onClick={load} className="bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400">
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && shown.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-60" />
          {filter === 'open' ? 'No open enquiries.' : 'No enquiries yet.'}
          <p className="text-gray-500 text-sm mt-1">Messages sent from the website&rsquo;s contact form appear here.</p>
        </div>
      )}

      <div className="space-y-4">
        {shown.map((e) => (
          <Card key={e.id} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-white font-semibold">{e.name}</h3>
                    <Badge className={STATUS_STYLE[e.status] || STATUS_STYLE.new}>{e.status}</Badge>
                    {e.projectType && (
                      <Badge variant="outline" className="border-slate-600 text-gray-400">
                        {e.projectType}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                    <a href={`mailto:${e.email}`} className="flex items-center gap-1 hover:text-white break-all">
                      <Mail className="w-3 h-3 shrink-0" /> {e.email}
                    </a>
                    {e.phone && (
                      <a href={`tel:${e.phone}`} className="flex items-center gap-1 hover:text-white">
                        <Phone className="w-3 h-3 shrink-0" /> {e.phone}
                      </a>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500">{formatWhen(e.createdAt)}</span>
              </div>

              <p className="text-gray-200 whitespace-pre-wrap break-words">{e.message}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => {
                    window.location.href = `mailto:${e.email}?subject=${encodeURIComponent('Re: your enquiry to Navish')}`;
                    if (e.status === 'new') setStatus(e.id, 'replied');
                  }}
                >
                  <Mail className="w-4 h-4 mr-1" /> Reply
                </Button>
                {e.status !== 'replied' && (
                  <Button size="sm" variant="outline" className="border-green-400 text-green-400 hover:bg-green-400 hover:text-white" onClick={() => setStatus(e.id, 'replied')}>
                    <Check className="w-4 h-4 mr-1" /> Mark replied
                  </Button>
                )}
                {e.status !== 'archived' ? (
                  <Button size="sm" variant="outline" className="border-slate-600" onClick={() => setStatus(e.id, 'archived')}>
                    <Archive className="w-4 h-4 mr-1" /> Archive
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="border-slate-600" onClick={() => setStatus(e.id, 'new')}>
                    Reopen
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
