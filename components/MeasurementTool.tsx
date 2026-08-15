import React from 'react';

interface MeasurementToolProps {
  sceneManager: any;
  onClose: () => void;
}

const MeasurementTool: React.FC<MeasurementToolProps> = ({ sceneManager, onClose }) => {
  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-gray-900 text-white p-4 z-50">
      <h2 className="text-lg font-bold mb-4">Measurement Tool</h2>
      <p>Measurement tool UI goes here.</p>
      <button onClick={onClose} className="mt-4 px-4 py-2 bg-red-600 rounded">
        Close
      </button>
    </div>
  );
};

export default MeasurementTool;
