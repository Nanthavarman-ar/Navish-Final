import React, { useEffect, useState } from 'react';
import { X, Radio, Power } from 'lucide-react';
import type { IoTManager } from './IoTManager';

interface IoTSensorsPanelProps {
  iotManager: IoTManager | null;
  onClose: () => void;
}

const statusColor = (value: number, threshold?: { min: number; max: number; warning: number }) => {
  if (!threshold) return 'bg-green-400';
  if (value >= threshold.warning) return 'bg-red-400';
  if (value > threshold.max || value < threshold.min) return 'bg-amber-400';
  return 'bg-green-400';
};

const deviceStatusColor = (status: string) =>
  status === 'online' ? 'bg-green-400' : status === 'error' ? 'bg-red-400' : 'bg-slate-500';

// IoTManager already existed as a complete client (device/sensor registry, real backend
// calls) but was never given a real serverUrl or a UI - see the wiring in
// BabylonWorkspace.tsx's IoTManager init block for why it was effectively dead. This is
// the first real consumer of getSensors()/getDevices()/sendCommand().
const IoTSensorsPanel: React.FC<IoTSensorsPanelProps> = ({ iotManager, onClose }) => {
  const [, forceTick] = useState(0);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);

  // Polled, not subscribed - IoTManager's device/sensor maps are plain mutated fields,
  // same reasoning as every other manager-backed panel in this app (MultiUserStatus etc).
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const sensors = iotManager?.getSensors() ?? [];
  const devices = iotManager?.getDevices() ?? [];

  const toggleDevice = async (deviceId: string) => {
    if (!iotManager) return;
    setPendingDeviceId(deviceId);
    try {
      await iotManager.sendCommand(deviceId, 'toggle');
    } finally {
      setPendingDeviceId(null);
      forceTick((n) => n + 1);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">IoT Sensors</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {!iotManager ? (
          <p className="text-sm text-gray-400">Not available for this session.</p>
        ) : (
          <>
            <div>
              <p className="text-xs text-gray-400 mb-2">Sensors</p>
              {sensors.length === 0 ? (
                <p className="text-xs text-gray-500">Connecting...</p>
              ) : (
                <ul className="space-y-2">
                  {sensors.map((sensor) => (
                    <li key={sensor.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(sensor.value, sensor.threshold)}`} aria-hidden />
                        <span className="text-gray-200 truncate">{sensor.name}</span>
                      </span>
                      <span className="font-technical text-cyan-300 shrink-0 ml-2">
                        {sensor.value}{sensor.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs text-gray-400 mb-2">Devices</p>
              {devices.length === 0 ? (
                <p className="text-xs text-gray-500">Connecting...</p>
              ) : (
                <ul className="space-y-2">
                  {devices.map((device) => (
                    <li key={device.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${deviceStatusColor(device.status)}`} aria-hidden />
                        <span className="text-gray-200 truncate">{device.name}</span>
                      </span>
                      {device.type === 'actuator' ? (
                        <button
                          type="button"
                          onClick={() => toggleDevice(device.id)}
                          disabled={pendingDeviceId === device.id}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-600 text-gray-300 hover:text-white hover:border-cyan-500/50 disabled:opacity-50 shrink-0 ml-2"
                        >
                          <Power className="w-3 h-3" />
                          {device.status === 'online' ? 'On' : 'Off'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 shrink-0 ml-2">{device.status}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default IoTSensorsPanel;
