import React from 'react';
import BabylonWorkspace from '../components/BabylonWorkspace';

const TestWorkspace: React.FC = () => {
  return (
    <div className="h-screen">
      <BabylonWorkspace
        workspaceId="test-workspace"
        isAdmin={true}
        enablePhysics={true}
        enableXR={true}
        enableSpatialAudio={true}
        renderingQuality="high"
        performanceMode="balanced"
      />
    </div>
  );
};

export default TestWorkspace;
