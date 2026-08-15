import React, { useState } from 'react';
import { Button } from './ui/button';
import { Share2, Code, Link2, Copy, Check } from 'lucide-react';
import { showToast } from './utils/toast';

interface ShareEmbedPanelProps {
  workspaceId: string;
  onClose?: () => void;
}

export function ShareEmbedPanel({ workspaceId, onClose }: ShareEmbedPanelProps) {
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/workspace` : '';
  const embedCode = `<iframe src="${shareUrl}" width="800" height="600" frameborder="0" allowfullscreen allow="xr-spatial-tracking"></iframe>`;

  const copyToClipboard = async (text: string, type: 'link' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      showToast.success('Copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast.error('Failed to copy');
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-4 w-96 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Share2 className="w-4 h-4 text-cyan-400" />
          Share & Embed
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">
            ×
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Share link</span>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(shareUrl, 'link')}
              className="border-slate-600"
            >
              {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Embed code</span>
          </div>
          <div className="relative">
            <textarea
              readOnly
              value={embedCode}
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-300 font-mono resize-none"
            />
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2 border-slate-600"
              onClick={() => copyToClipboard(embedCode, 'embed')}
            >
              {copied === 'embed' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
