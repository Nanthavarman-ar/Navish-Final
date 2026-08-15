import React, { useState } from 'react';

interface TestResult {
  status: 'pass' | 'fail' | 'pending';
  message: string;
}

interface ButtonTest {
  id: string;
  selector: string;
  name: string;
}

const ButtonTestRunner = () => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunning, setIsRunning] = useState(false);

  const buttonTests = [
    { id: 'weather', selector: '[title="Weather System"]', name: 'Weather Toggle' },
    { id: 'flood', selector: '[title="Flood Simulation"]', name: 'Flood Toggle' },
    { id: 'wind', selector: '[title="Wind Tunnel"]', name: 'Wind Tunnel Toggle' },
    { id: 'noise', selector: '[title="Noise Simulation"]', name: 'Noise Toggle' },
    { id: 'shadow', selector: '[title="Shadow Analysis"]', name: 'Shadow Toggle' },
    { id: 'measure', selector: '[title="Measure Tool"]', name: 'Measure Tool Toggle' },
    { id: 'ai-advisor', selector: '[title="AI Structural Advisor"]', name: 'AI Advisor Toggle' },
    { id: 'property-inspector', selector: '[title="Property Inspector"]', name: 'Property Inspector Toggle' },
    { id: 'workspace-mode', selector: '[title="Workspace Mode"]', name: 'Workspace Mode Toggle' }
  ];

  const testButton = (test: ButtonTest): TestResult => {
    try {
      const button = document.querySelector(test.selector) as HTMLButtonElement;
      if (button) {
        // Check if button is clickable
        const isClickable = !button.disabled && button.offsetParent !== null;
        if (isClickable) {
          return { status: 'pass', message: 'Button found and clickable' };
        } else {
          return { status: 'fail', message: 'Button found but not clickable' };
        }
      } else {
        return { status: 'fail', message: 'Button not found in DOM' };
      }
    } catch (error) {
      return { status: 'fail', message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults({});

    for (const test of buttonTests) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const result = testButton(test);
      setTestResults(prev => ({
        ...prev,
        [test.id]: result
      }));
    }

    setIsRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-400';
      case 'fail': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const passedCount = Object.values(testResults).filter((r: TestResult) => r.status === 'pass').length;
  const failedCount = Object.values(testResults).filter((r: TestResult) => r.status === 'fail').length;

  return (
    <div className="fixed top-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-4 z-50 w-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">Button Test</h3>
        <button
          onClick={runTests}
          disabled={isRunning}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? 'Testing...' : 'Test Buttons'}
        </button>
      </div>

      {Object.keys(testResults).length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-300">
            Results: <span className="text-green-400">{passedCount} passed</span>, <span className="text-red-400">{failedCount} failed</span>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {buttonTests.map((test) => {
          const result = testResults[test.id];
          return (
            <div key={test.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{test.name}</span>
              <span className={getStatusColor(result?.status)}>
                {result?.status || 'pending'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ButtonTestRunner;