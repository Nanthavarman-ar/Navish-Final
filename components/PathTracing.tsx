import React from 'react';

interface PathTracingProps {
  scene: any;
  isActive: boolean;
}

export const PathTracing: React.FC<PathTracingProps> = ({
  scene,
  isActive
}) => {
  if (!isActive) return null;

  return (
    <div className="fixed top-4 left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
      <h3 className="text-white mb-2">Path Tracing</h3>
      <p className="text-slate-300 text-sm">Path tracing active</p>
    </div>
  );
};

export default PathTracing;
