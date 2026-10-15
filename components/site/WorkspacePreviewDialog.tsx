import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Smartphone, Move, Monitor, Tablet, Square, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
// Lazy-loaded: only rendered once the preview is opened - a static import would pull
// the full Babylon.js engine (~1.25MB gzip) into every landing-page visit.
const BabylonWorkspace = React.lazy(() => import('../BabylonWorkspace'));

// The draggable / resizable workspace preview that used to live inline (twice) in the
// old landing Header and Home. Behaviour is unchanged: drag by the window, resize from
// any edge/corner, and 1-4 / 0 keys for size presets while it's open.
export function WorkspacePreviewDialog({
  open,
  onOpenChange,
  workspaceId,
  isAdmin,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  isAdmin: boolean;
  title: string;
}) {
  // Opened as a 375x667 window pinned at (50,50) on every screen: on a phone that ran
  // past the right edge (close button unreachable) and on desktop it was a tiny window
  // the tool panel covered almost entirely. Now: full-screen on phones, a large centred
  // window elsewhere, re-fitted whenever it opens or the browser resizes.
  const [isCompact, setIsCompact] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 48, y: 48 });
  const [modalSize, setModalSize] = useState({ width: 1200, height: 800 });

  const fitToViewport = React.useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const compact = vw < 768;
    setIsCompact(compact);
    if (compact) {
      setModalPosition({ x: 0, y: 0 });
      setModalSize({ width: vw, height: vh });
      return;
    }
    const width = Math.min(1280, vw - 96);
    const height = Math.min(820, vh - 96);
    setModalSize({ width, height });
    setModalPosition({ x: Math.round((vw - width) / 2), y: Math.round((vh - height) / 2) });
  }, []);

  useEffect(() => {
    if (!open) return;
    fitToViewport();
    window.addEventListener('resize', fitToViewport);
    return () => window.removeEventListener('resize', fitToViewport);
  }, [open, fitToViewport]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 375, height: 667 });
  const [resizeDirection, setResizeDirection] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  const setSizePreset = (width: number, height: number) => {
    if (isCompact) return;
    const w = Math.min(width, window.innerWidth);
    const h = Math.min(height, window.innerHeight);
    // Keep the whole window on screen after resizing.
    setModalSize({ width: w, height: h });
    setModalPosition((pos) => ({
      x: Math.max(0, Math.min(pos.x, window.innerWidth - w)),
      y: Math.max(0, Math.min(pos.y, window.innerHeight - h)),
    }));
  };

  // Keyboard shortcuts for size adjustment
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!open) return;
      // Typing a number into the workspace's tool search (or any field) used to resize
      // the window.
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case '1':
          setSizePreset(375, 667); // Mobile
          break;
        case '2':
          setSizePreset(768, 1024); // Tablet
          break;
        case '3':
          setSizePreset(1200, 800); // Desktop
          break;
        case '4':
          setSizePreset(1920, 1080); // Full HD
          break;
        case '0':
          setSizePreset(375, 667); // Reset to mobile
          break;
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [open, isCompact]);

  // Drag by the title bar only. It used to be bound to the whole window, so orbiting
  // the 3D view (or pressing any workspace button) dragged the window around instead.
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCompact || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const maxX = Math.max(0, window.innerWidth - modalSize.width);
    const maxY = Math.max(0, window.innerHeight - modalSize.height);
    setModalPosition({
      x: Math.max(0, Math.min(e.clientX - dragStart.x, maxX)),
      y: Math.max(0, Math.min(e.clientY - dragStart.y, maxY)),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Resize functionality
  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    if (isCompact) return;
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({ x: e.clientX, y: e.clientY, width: modalSize.width, height: modalSize.height });
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!isResizing || !resizeDirection) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    const minWidth = 300;
    const minHeight = 400;
    const maxWidth = window.innerWidth - modalPosition.x;
    const maxHeight = window.innerHeight - modalPosition.y;
    const clampW = (w: number) => Math.max(minWidth, Math.min(w, maxWidth));
    const clampH = (h: number) => Math.max(minHeight, Math.min(h, maxHeight));

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    if (resizeDirection.includes('e')) newWidth = clampW(resizeStart.width + deltaX);
    if (resizeDirection.includes('w')) newWidth = clampW(resizeStart.width - deltaX);
    if (resizeDirection.includes('s')) newHeight = clampH(resizeStart.height + deltaY);
    if (resizeDirection.includes('n')) newHeight = clampH(resizeStart.height - deltaY);
    setModalSize({ width: newWidth, height: newHeight });
  };

  const handleResizeMouseUp = () => {
    setIsResizing(false);
    setResizeDirection('');
  };

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (!isResizing) return;
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing, resizeDirection, resizeStart]);

  const sizeButtons: Array<[number, number, string, React.ElementType]> = [
    [375, 667, 'Mobile Size (1)', Smartphone],
    [768, 1024, 'Tablet Size (2)', Tablet],
    [1200, 800, 'Desktop Size (3)', Monitor],
    [1920, 1080, 'Full HD Size (4)', Square],
  ];

  const handles: Array<[string, string]> = [
    ['se', 'absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize'],
    ['sw', 'absolute -bottom-1 -left-1 w-4 h-4 cursor-sw-resize'],
    ['ne', 'absolute -top-1 -right-1 w-4 h-4 cursor-ne-resize'],
    ['nw', 'absolute -top-1 -left-1 w-4 h-4 cursor-nw-resize'],
    ['n', 'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-8 h-2 cursor-n-resize'],
    ['s', 'absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-8 h-2 cursor-s-resize'],
    ['w', 'absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-8 cursor-w-resize'],
    ['e', 'absolute right-0 top-1/2 translate-x-1 -translate-y-1/2 w-2 h-8 cursor-e-resize'],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={modalRef}
        data-lenis-prevent
        hideCloseButton
        aria-describedby={undefined}
        className="p-0 border-0 rounded-[2px] flex flex-col gap-0 overflow-hidden"
        style={{
          position: 'fixed',
          left: `${modalPosition.x}px`,
          top: `${modalPosition.y}px`,
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          transform: 'none',
          // DialogContent centres itself with Tailwind v4's translate-x/y utilities, which
          // set the separate `translate` property - `transform: none` alone doesn't undo it,
          // so the window used to sit half off-screen to the top-left.
          translate: 'none',
          maxWidth: 'none',
          backgroundColor: '#1a1a1a',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        }}
      >
        <DialogHeader
          className={`px-4 sm:px-5 py-3 bg-[#1a1a1a] border-b border-white/10 select-none ${isCompact ? '' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold uppercase tracking-[0.12em] text-[#ecebeb]">
              {title}
            </DialogTitle>
            <div className="flex items-center gap-2 text-[#ecebeb]/60">
              {!isCompact && <Move className="w-4 h-4" aria-hidden />}
              <div className={`items-center gap-1 ${isCompact ? 'hidden' : 'flex'}`}>
                {sizeButtons.map(([w, h, label, Icon]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSizePreset(w, h)}
                    className="p-1 hover:text-[#ff4d4f] transition-colors"
                    title={label}
                    aria-label={label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
              {!isCompact && (
                <div className="text-xs px-2 py-1 bg-white/10 rounded-[2px] tabular-nums">
                  {modalSize.width}×{modalSize.height}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                className="p-2 -mr-1 text-[#ecebeb] hover:text-[#ff4d4f] transition-colors"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Fills exactly the space under the header - it used to be h-full PLUS the header,
            so it scrolled by the header's height, and the canvas jumped mid-click. */}
        <div className="flex-1 min-h-0 p-0 bg-[#111] overflow-hidden w-full">
          <div className="w-full h-full">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-[#ff4d4f] border-t-transparent rounded-full" />
                </div>
              }
            >
              <BabylonWorkspace
                workspaceId={workspaceId}
                isAdmin={isAdmin}
                layoutMode="compact"
                performanceMode="medium"
                enablePhysics={false}
                enableXR={true}
                enableSpatialAudio={false}
                renderingQuality="high"
              />
            </Suspense>
          </div>
        </div>

        {!isCompact && handles.map(([dir, cls]) => (
          <div
            key={dir}
            className={`${cls} bg-[#ff4d4f]/60 hover:bg-[#ff4d4f]`}
            onMouseDown={(e) => handleResizeMouseDown(e, dir)}
          />
        ))}
      </DialogContent>
    </Dialog>
  );
}

