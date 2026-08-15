import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, AlertCircle, Play } from 'lucide-react';

interface TestResult {
  status: 'pass' | 'fail';
  message: string;
}

interface ButtonTest {
  id: string;
  name: string;
  category: string;
  test: () => TestResult;
}

const BabylonWorkspaceButtonTest = () => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunning, setIsRunning] = useState(false);

  const buttonTests: ButtonTest[] = [
    // Simulation Features
    { id: 'weather-toggle', name: 'Weather System Toggle', category: 'Simulation', test: () => testWeatherToggle() },
    { id: 'flood-toggle', name: 'Flood Simulation Toggle', category: 'Simulation', test: () => testFloodToggle() },
    { id: 'enhanced-flood-toggle', name: 'Enhanced Flood Toggle', category: 'Simulation', test: () => testEnhancedFloodToggle() },
    { id: 'wind-tunnel-toggle', name: 'Wind Tunnel Toggle', category: 'Simulation', test: () => testWindTunnelToggle() },
    { id: 'noise-toggle', name: 'Noise Simulation Toggle', category: 'Simulation', test: () => testNoiseToggle() },
    { id: 'traffic-toggle', name: 'Traffic & Parking Toggle', category: 'Simulation', test: () => testTrafficToggle() },
    { id: 'shadow-toggle', name: 'Shadow Analysis Toggle', category: 'Simulation', test: () => testShadowToggle() },
    { id: 'circulation-toggle', name: 'Circulation Flow Toggle', category: 'Simulation', test: () => testCirculationToggle() },

    // Analysis Features
    { id: 'measure-toggle', name: 'Measure Tool Toggle', category: 'Analysis', test: () => testMeasureToggle() },
    { id: 'ergonomic-toggle', name: 'Ergonomic Testing Toggle', category: 'Analysis', test: () => testErgonomicToggle() },
    { id: 'energy-toggle', name: 'Energy Analysis Toggle', category: 'Analysis', test: () => testEnergyToggle() },
    { id: 'cost-estimator-toggle', name: 'Cost Estimator Toggle', category: 'Analysis', test: () => testCostEstimatorToggle() },
    { id: 'sound-privacy-toggle', name: 'Sound Privacy Toggle', category: 'Analysis', test: () => testSoundPrivacyToggle() },
    { id: 'furniture-toggle', name: 'Furniture Clearance Toggle', category: 'Analysis', test: () => testFurnitureToggle() },

    // AI Features
    { id: 'ai-advisor-toggle', name: 'AI Structural Advisor Toggle', category: 'AI', test: () => testAiAdvisorToggle() },
    { id: 'auto-furnish-toggle', name: 'Auto-Furnish Toggle', category: 'AI', test: () => testAutoFurnishToggle() },
    { id: 'ai-codesigner-toggle', name: 'AI Co-Designer Toggle', category: 'AI', test: () => testAiCoDesignerToggle() },
    { id: 'voice-chat-toggle', name: 'Voice Assistant Toggle', category: 'AI', test: () => testVoiceChatToggle() },

    // Environment Features
    { id: 'site-context-toggle', name: 'Site Context Toggle', category: 'Environment', test: () => testSiteContextToggle() },
    { id: 'topography-toggle', name: 'Topography Toggle', category: 'Environment', test: () => testTopographyToggle() },
    { id: 'lighting-mood-toggle', name: 'Lighting Moods Toggle', category: 'Environment', test: () => testLightingMoodToggle() },
    { id: 'geo-location-toggle', name: 'Geo Location Toggle', category: 'Environment', test: () => testGeoLocationToggle() },

    // Construction Features
    { id: 'construction-toggle', name: 'Construction Overlay Toggle', category: 'Construction', test: () => testConstructionToggle() },

    // Interaction Features
    { id: 'multi-sensory-toggle', name: 'Multi-Sensory Toggle', category: 'Interaction', test: () => testMultiSensoryToggle() },
    { id: 'vr-ar-toggle', name: 'VR/AR Mode Toggle', category: 'Interaction', test: () => testVrArToggle() },
    { id: 'hand-tracking-toggle', name: 'Hand Tracking Toggle', category: 'Interaction', test: () => testHandTrackingToggle() },

    // Collaboration Features
    { id: 'presenter-mode-toggle', name: 'Presenter Mode Toggle', category: 'Collaboration', test: () => testPresenterModeToggle() },
    { id: 'annotations-toggle', name: 'Annotations Toggle', category: 'Collaboration', test: () => testAnnotationsToggle() },

    // Utilities
    { id: 'property-inspector-toggle', name: 'Property Inspector Toggle', category: 'Utilities', test: () => testPropertyInspectorToggle() },
    { id: 'workspace-mode-toggle', name: 'Workspace Mode Toggle', category: 'Utilities', test: () => testWorkspaceModeToggle() },

    // Advanced Features
    { id: 'path-tracing-toggle', name: 'Path Tracing Toggle', category: 'Advanced', test: () => testPathTracingToggle() },
    { id: 'iot-integration-toggle', name: 'IoT Integration Toggle', category: 'Advanced', test: () => testIotIntegrationToggle() },

    // Animation Controls
    { id: 'animation-play-pause', name: 'Animation Play/Pause Button', category: 'Animation', test: () => testAnimationPlayPause() },
    { id: 'animation-selector', name: 'Animation Selector Dropdown', category: 'Animation', test: () => testAnimationSelector() },

    // Weather Controls
    { id: 'weather-type-selector', name: 'Weather Type Selector', category: 'Weather', test: () => testWeatherTypeSelector() },
    { id: 'weather-intensity-slider', name: 'Weather Intensity Slider', category: 'Weather', test: () => testWeatherIntensitySlider() },

    // Property Panel Controls
    { id: 'position-x-input', name: 'Position X Input', category: 'Property Panel', test: () => testPositionXInput() },
    { id: 'position-y-input', name: 'Position Y Input', category: 'Property Panel', test: () => testPositionYInput() },
    { id: 'position-z-input', name: 'Position Z Input', category: 'Property Panel', test: () => testPositionZInput() },
    { id: 'material-color-picker', name: 'Material Color Picker', category: 'Property Panel', test: () => testMaterialColorPicker() }
  ];

  // Test Functions
  const testWeatherToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Weather System"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Weather toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Weather toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testFloodToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Flood Simulation"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Flood toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Flood toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testEnhancedFloodToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Enhanced Flood"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Enhanced flood toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Enhanced flood toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testWindTunnelToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Wind Tunnel"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Wind tunnel toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Wind tunnel toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testNoiseToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Noise Simulation"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Noise simulation toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Noise simulation toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testTrafficToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Traffic & Parking"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Traffic & parking toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Traffic & parking toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testShadowToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Shadow Analysis"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Shadow analysis toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Shadow analysis toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testCirculationToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Circulation Flow"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Circulation flow toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Circulation flow toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testMeasureToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Measure Tool"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Measure tool toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Measure tool toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testErgonomicToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Ergonomic Testing"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Ergonomic testing toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Ergonomic testing toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testEnergyToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Energy Analysis"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Energy analysis toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Energy analysis toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testCostEstimatorToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Cost Estimator"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Cost estimator toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Cost estimator toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testSoundPrivacyToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Sound Privacy"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Sound privacy toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Sound privacy toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testFurnitureToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Furniture Clearance"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Furniture clearance toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Furniture clearance toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testAiAdvisorToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="AI Structural Advisor"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'AI structural advisor toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'AI structural advisor toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testAutoFurnishToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Auto-Furnish"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Auto-furnish toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Auto-furnish toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testAiCoDesignerToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="AI Co-Designer"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'AI co-designer toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'AI co-designer toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testVoiceChatToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Voice Assistant"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Voice assistant toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Voice assistant toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testSiteContextToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Site Context"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Site context toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Site context toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testTopographyToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Topography"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Topography toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Topography toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testLightingMoodToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Lighting Moods"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Lighting moods toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Lighting moods toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testGeoLocationToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Geo Location"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Geo location toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Geo location toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testConstructionToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Construction Overlay"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Construction overlay toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Construction overlay toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testMultiSensoryToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Multi-Sensory"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Multi-sensory toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Multi-sensory toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testVrArToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="VR/AR Mode"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'VR/AR mode toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'VR/AR mode toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testHandTrackingToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Hand Tracking"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Hand tracking toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Hand tracking toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testPresenterModeToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Presenter Mode"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Presenter mode toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Presenter mode toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testAnnotationsToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Annotations"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Annotations toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Annotations toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testPropertyInspectorToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Property Inspector"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Property inspector toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Property inspector toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testWorkspaceModeToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Workspace Mode"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Workspace mode toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Workspace mode toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testPathTracingToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="Path Tracing"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Path tracing toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'Path tracing toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testIotIntegrationToggle = (): TestResult => {
    try {
      const button = document.querySelector('[title="IoT Integration"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'IoT integration toggle button clicked successfully' };
      }
      return { status: 'fail', message: 'IoT integration toggle button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testAnimationPlayPause = (): TestResult => {
    try {
      const button = document.querySelector('[title="Play/Pause Animation"]') as HTMLElement;
      if (button) {
        button.click();
        return { status: 'pass', message: 'Animation play/pause button clicked successfully' };
      }
      return { status: 'fail', message: 'Animation play/pause button not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testAnimationSelector = (): TestResult => {
    try {
      const selector = document.querySelector('[data-testid="animation-selector"]') as HTMLElement;
      if (selector) {
        return { status: 'pass', message: 'Animation selector found successfully' };
      }
      return { status: 'fail', message: 'Animation selector not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testWeatherTypeSelector = (): TestResult => {
    try {
      const selector = document.querySelector('[data-testid="weather-type-selector"]') as HTMLElement;
      if (selector) {
        return { status: 'pass', message: 'Weather type selector found successfully' };
      }
      return { status: 'fail', message: 'Weather type selector not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testWeatherIntensitySlider = (): TestResult => {
    try {
      const slider = document.querySelector('[data-testid="weather-intensity-slider"]') as HTMLElement;
      if (slider) {
        return { status: 'pass', message: 'Weather intensity slider found successfully' };
      }
      return { status: 'fail', message: 'Weather intensity slider not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testPositionXInput = (): TestResult => {
    try {
      const input = document.querySelector('[data-testid="position-x-input"]') as HTMLElement;
      if (input) {
        return { status: 'pass', message: 'Position X input found successfully' };
      }
      return { status: 'fail', message: 'Position X input not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testPositionYInput = (): TestResult => {
    try {
      const input = document.querySelector('[data-testid="position-y-input"]') as HTMLElement;
      if (input) {
        return { status: 'pass', message: 'Position Y input found successfully' };
      }
      return { status: 'fail', message: 'Position Y input not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testPositionZInput = (): TestResult => {
    try {
      const input = document.querySelector('[data-testid="position-z-input"]') as HTMLElement;
      if (input) {
        return { status: 'pass', message: 'Position Z input found successfully' };
      }
      return { status: 'fail', message: 'Position Z input not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const testMaterialColorPicker = (): TestResult => {
    try {
      const picker = document.querySelector('[data-testid="material-color-picker"]') as HTMLElement;
      if (picker) {
        return { status: 'pass', message: 'Material color picker found successfully' };
      }
      return { status: 'fail', message: 'Material color picker not found' };
    } catch (error) {
      return { status: 'fail', message: (error as Error).message };
    }
  };

  const runSingleTest = async (testId: string) => {
    const test = buttonTests.find(t => t.id === testId);
    if (!test) return;

    try {
      const result = test.test();
      setTestResults(prev => ({ ...prev, [testId]: result }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testId]: { status: 'fail', message: (error as Error).message }
      }));
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});

    for (const test of buttonTests) {
      try {
        const result = test.test();
        setTestResults(prev => ({ ...prev, [test.id]: result }));
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        setTestResults(prev => ({
          ...prev,
          [test.id]: { status: 'fail', message: (error as Error).message }
        }));
      }
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'pass' ? 'default' : status === 'fail' ? 'destructive' : 'secondary';
    return <Badge variant={variant}>{status}</Badge>;
  };

  const groupedTests = buttonTests.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = [];
    acc[test.category].push(test);
    return acc;
  }, {} as Record<string, ButtonTest[]>);

  const totalTests = buttonTests.length;
  const completedTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(r => r.status === 'pass').length;
  const failedTests = Object.values(testResults).filter(r => r.status === 'fail').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Babylon Workspace Button Test Suite
          </CardTitle>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total: {totalTests}</span>
            <span>Completed: {completedTests}</span>
            <span className="text-green-600">Passed: {passedTests}</span>
            <span className="text-red-600">Failed: {failedTests}</span>
          </div>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runAllTests} 
            disabled={isRunning}
            className="mb-4"
          >
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {Object.entries(groupedTests).map(([category, tests]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category} Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {tests.map(test => {
                  const result = testResults[test.id];
                  return (
                    <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {result && getStatusIcon(result.status)}
                        <div>
                          <div className="font-medium">{test.name}</div>
                          {result && (
                            <div className="text-sm text-muted-foreground">
                              {result.message}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result && getStatusBadge(result.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runSingleTest(test.id)}
                        >
                          Test
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BabylonWorkspaceButtonTest;