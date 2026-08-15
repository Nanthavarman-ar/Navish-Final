import React from 'react';
import * as BABYLON from '@babylonjs/core';

interface ExportToolProps {
  scene: BABYLON.Scene;
  isActive?: boolean;
  onClose?: () => void;
  className?: string;
}

const EXPORT_BASE_POSITION = 'absolute top-15 right-2.5 w-72';

const ExportTool: React.FC<ExportToolProps> = ({ scene, isActive = true, onClose, className }) => {
  if (!isActive) return null;

  const positionClasses = className ?? EXPORT_BASE_POSITION;

  return (
    <div className={`${positionClasses} bg-black bg-opacity-90 rounded-lg p-4 text-white text-xs z-[1000]`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="m-0 text-cyan-400 text-sm">Export Tool</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-300 transition hover:text-white"
          >
            Close
          </button>
        )}
      </div>
      <p className="mb-2 text-xs">This feature enables scene export functionality.</p>
      <p className="text-xs">Feature coming soon.</p>
    </div>
  );
};

export default ExportTool;
