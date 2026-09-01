import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';

interface MobileHandoffPanelProps {
  onClose: () => void;
}

// Encodes the real current workspace URL - not a data blob - so any phone camera app
// can scan it and open the exact same workspace directly in its own mobile browser.
const MobileHandoffPanel: React.FC<MobileHandoffPanelProps> = ({ onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const url = typeof window !== 'undefined' ? window.location.href : '';
  // A phone scanning this QR code has to reach `url` over the network - during
  // local dev that's "localhost", which only ever means the phone itself, so
  // the scan will always fail to load until this is a real deployed domain
  // (or the dev server is reached via this machine's LAN IP instead).
  const isLocalDev = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast.success('Link copied');
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed right-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">View on Your Phone</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-400 text-center">
          Scan with your phone's camera to open this exact workspace on your own device (great for AR).
        </p>
        {isLocalDev && (
          <p className="text-xs text-amber-400 text-center bg-amber-950/40 border border-amber-800/50 rounded p-2">
            This is a local dev address ({window.location.hostname}) - your phone can't reach it over the internet.
            Scanning will only work once this is deployed, or if your phone is on the same Wi-Fi and you open the
            dev server via this computer's LAN IP instead of localhost.
          </p>
        )}
        <div className="bg-white p-3 rounded-lg">
          <QRCodeSVG value={url} size={160} />
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={handleCopy}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy link instead
        </Button>
      </div>
    </div>
  );
};

export default MobileHandoffPanel;
