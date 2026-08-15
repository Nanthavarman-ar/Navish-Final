import React from 'react';
import BabylonWorkspace from './BabylonWorkspace';

const WorkspacePage = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <BabylonWorkspace workspaceId="main-workspace" />
    </div>
  );
};

export default WorkspacePage;
