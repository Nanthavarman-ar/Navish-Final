import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { CostEstimator } from './CostEstimator';
import { BIMManager, BIMElement } from './BIMManager';
import { SimulationManager } from './SimulationManager';
import { FeatureManager, DeviceCapabilities } from './FeatureManager';
import { CostBreakdownSection } from './BabylonWorkspace/ui/CostBreakdownSection';
import styles from './CostEstimatorWrapper.module.css';

interface CostEstimatorWrapperProps {
  scene: BABYLON.Scene;
  selectedMesh: BABYLON.AbstractMesh | null;
  onCostUpdate?: (totalCost: number, breakdown: any) => void;
  bimManager?: BIMManager;
  simulationManager?: SimulationManager;
}

interface CostState {
  totalCost: number;
  breakdown: any | null;
  selectedElement: BIMElement | null;
  isCalculating: boolean;
  error: string | null;
}

const CostEstimatorWrapper: React.FC<CostEstimatorWrapperProps> = ({
  scene,
  selectedMesh,
  onCostUpdate,
  bimManager: externalBimManager,
  simulationManager: externalSimulationManager
}) => {
  // Helper functions for element type determination
  const determineElementTypeFallback = (name: string): BIMElement['type'] => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('wall')) return 'wall';
    if (nameLower.includes('floor')) return 'floor';
    if (nameLower.includes('ceiling')) return 'ceiling';
    if (nameLower.includes('door')) return 'door';
    if (nameLower.includes('window')) return 'window';
    if (nameLower.includes('beam')) return 'beam';
    if (nameLower.includes('column')) return 'column';
    if (nameLower.includes('roof')) return 'roof';
    if (nameLower.includes('slab')) return 'slab';
    return 'wall'; // Default fallback
  };

  const determineElementCategoryFallback = (type: BIMElement['type']): BIMElement['category'] => {
    const categoryMap: Record<BIMElement['type'], BIMElement['category']> = {
      wall: 'Architecture',
      floor: 'Architecture',
      ceiling: 'Architecture',
      door: 'Architecture',
      window: 'Architecture',
      beam: 'Structure',
      column: 'Structure',
      roof: 'Architecture',
      slab: 'Architecture',
      duct: 'MEP',
      pipe: 'MEP',
      cable: 'MEP',
      fixture: 'Interior'
    };
    return categoryMap[type] || 'Architecture';
  };

  const getDefaultMaterialForTypeFallback = (type: string): string => {
    const materialMap: Record<string, string> = {
      wall: 'concrete_standard',
      floor: 'concrete_standard',
      ceiling: 'concrete_standard',
      door: 'wood_sustainable',
      window: 'glass_standard',
      beam: 'steel_standard',
      column: 'steel_standard',
      roof: 'concrete_standard',
      slab: 'concrete_standard'
    };
    return materialMap[type] || 'concrete_standard';
  };
  const costEstimatorRef = useRef<CostEstimator | null>(null);
  const bimManagerRef = useRef<BIMManager | null>(null);
  const simulationManagerRef = useRef<SimulationManager | null>(null);

  // Manual overrides for the cost breakdown, keyed by element id - once a user edits
  // and saves an element's costs, re-selecting it (or region/budget changes triggering
  // a recalculation) must keep showing the saved figures instead of silently
  // recalculating over them.
  const breakdownOverridesRef = useRef<Map<string, { material: number; labor: number; equipment: number; overhead: number; total: number }>>(new Map());
  const [isEditingBreakdown, setIsEditingBreakdown] = useState(false);
  const [breakdownDraft, setBreakdownDraft] = useState<{ material: number; labor: number; equipment: number; overhead: number; total: number } | null>(null);

  const [costState, setCostState] = useState<CostState>({
    totalCost: 0,
    breakdown: null,
    selectedElement: null,
    isCalculating: false,
    error: null
  });

  const [region, setRegion] = useState<string>('US_East');
  const [budget, setBudget] = useState<number>(100000);

  // The underlying CostEstimator database is USD-denominated; this only
  // converts for display when India is selected (indicative rate, not a
  // live FX feed - good enough for a ballpark budget conversation, not for
  // an actual quote).
  const USD_TO_INR = 83;
  const isIndia = region === 'India';
  const formatCost = (usdAmount: number): string => {
    if (isIndia) {
      return `₹${(usdAmount * USD_TO_INR).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    }
    return `$${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Built-up floor area, from the actual loaded model's real footprint (not
  // a guess) - used for the Rs./sq ft figure that's how construction cost is
  // actually communicated and understood in India.
  const getBuiltUpAreaSqft = (): number | null => {
    const realMeshes = scene.meshes.filter((m) =>
      m.isEnabled() && m.getTotalVertices() > 0 && m.name && !/^(ground|__root__|measure_|preview_)/i.test(m.name)
    );
    if (realMeshes.length === 0) return null;
    let min = realMeshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = realMeshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
    realMeshes.forEach((m) => {
      const bb = m.getBoundingInfo().boundingBox;
      min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
    });
    const areaSqm = (max.x - min.x) * (max.z - min.z);
    if (areaSqm <= 0) return null;
    return areaSqm * 10.7639; // m^2 -> sq ft
  };

  // Upload a reference PDF (e.g. a contractor quote) and preview it in a
  // small side panel - can be closed and reopened freely since the blob URL
  // stays alive for the life of the component, only the panel's visibility
  // toggles.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    const url = URL.createObjectURL(file);
    pdfUrlRef.current = url;
    setPdfUrl(url);
    setPdfFileName(file.name);
    setShowPdfPreview(true);
    e.target.value = '';
  };

  // Model-wide cost data for when no element is selected
  const [modelCostData, setModelCostData] = useState<{
    total: number;
    labor: number;
    materials: number;
    overhead: number;
    elements: Array<{ id: string; name: string; cost: number }>;
  } | null>(null);

  // Initialize managers and cost estimator
  useEffect(() => {
    try {
      // Create FeatureManager with basic device capabilities
      const deviceCapabilities: DeviceCapabilities = {
        webgl: true,
        webgl2: true,
        webxr: false,
        webrtc: true,
        webassembly: true,
        gpuMemory: 1024, // MB
        cpuCores: 4,
        ram: 8192, // MB
        networkType: 'fast',
        touchEnabled: false,
        mobile: false
      };

      const featureManager = new FeatureManager(deviceCapabilities);

      // Use external managers if provided, otherwise create new ones
      // Cast scene.getEngine() to Engine to satisfy type requirements
      const engine = scene.getEngine() as BABYLON.Engine;
      const bimManager = externalBimManager || new BIMManager(engine, scene);
      const simulationManager = externalSimulationManager || new SimulationManager(engine, scene, featureManager);

      bimManagerRef.current = bimManager;
      simulationManagerRef.current = simulationManager;

      // Instantiate CostEstimator with dependencies
      costEstimatorRef.current = new CostEstimator(bimManager, simulationManager);

      // Set budget if specified
      if (budget > 0) {
        costEstimatorRef.current.setClientBudget(budget);
      }

      console.log('CostEstimator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CostEstimator:', error);
      setCostState(prev => ({
        ...prev,
        error: 'Failed to initialize cost estimation system'
      }));
    }

    return () => {
      // Dispose resources on unmount
      if (costEstimatorRef.current) {
        costEstimatorRef.current.dispose();
        costEstimatorRef.current = null;
      }
      // Only dispose if we created them
      if (!externalBimManager && bimManagerRef.current) {
        // BIMManager dispose method if available
      }
      if (!externalSimulationManager && simulationManagerRef.current) {
        // SimulationManager dispose method if available
      }
    };
  }, [scene, externalBimManager, externalSimulationManager, budget]);

  // Fetch model-wide cost data when BIM manager is available and region changes
  useEffect(() => {
    if (bimManagerRef.current) {
      const models = bimManagerRef.current.getAllModels();
      if (models.length > 0) {
        try {
          // Get the first available model ID (or use the first one)
          const modelId = models[0].id;
          const costData = bimManagerRef.current.getCostDisplayData(modelId, region);
          setModelCostData(costData);
        } catch (error) {
          console.error('Failed to fetch model cost data:', error);
          setModelCostData(null);
        }
      } else {
        setModelCostData(null);
      }
    } else {
      setModelCostData(null);
    }
  }, [region, bimManagerRef.current]);

  // Validate BIM element data
  const validateBIMElement = (element: BIMElement): boolean => {
    if (!element.id || !element.name || !element.type) {
      console.warn('Invalid BIM element: missing required properties', element);
      return false;
    }
    if (!element.position || !element.rotation || !element.scale) {
      console.warn('Invalid BIM element: missing transform properties', element);
      return false;
    }
    return true;
  };

  // Enhanced error handling for cost calculations
  const calculateMeshCost = useCallback(async (mesh: BABYLON.AbstractMesh) => {
    if (!costEstimatorRef.current || !bimManagerRef.current) {
      setCostState(prev => ({
        ...prev,
        error: 'Cost estimation system not initialized'
      }));
      return;
    }

    if (!mesh) {
      setCostState(prev => ({
        ...prev,
        error: 'No mesh selected for cost calculation'
      }));
      return;
    }

    setCostState(prev => ({ ...prev, isCalculating: true, error: null }));

    try {
      // Extract element information from mesh metadata or create from mesh properties
      let element: BIMElement | null = null;

      if (mesh.metadata?.elementId) {
        // If mesh has BIM element metadata
        element = bimManagerRef.current.getElementById(mesh.metadata.elementId);
        if (!element) {
          throw new Error(`BIM element with ID ${mesh.metadata.elementId} not found`);
        }
      } else {
        // Create a basic BIM element from mesh properties
        const boundingInfo = mesh.getBoundingInfo();
        const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

        // Validate mesh geometry
        if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
          throw new Error('Invalid mesh geometry: zero or negative dimensions');
        }

        // Fallback simple element type determination
        const elementType = determineElementTypeFallback(mesh.name);
        const elementProperties = mesh.metadata || {};

        element = {
          id: mesh.id,
          name: mesh.name || `Element_${mesh.id}`,
          type: elementType,
          category: determineElementCategoryFallback(elementType),
          position: new BABYLON.Vector3(mesh.position.x, mesh.position.y, mesh.position.z),
          rotation: new BABYLON.Vector3(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z),
          scale: new BABYLON.Vector3(mesh.scaling.x, mesh.scaling.y, mesh.scaling.z),
          material: mesh.metadata?.material || getDefaultMaterialForTypeFallback(elementType),
          properties: elementProperties,
          visible: mesh.isVisible ?? true
        };
      }

      // Validate the created/retrieved element
      if (!element || !validateBIMElement(element)) {
        throw new Error('Invalid BIM element data');
      }

      // Calculate quantity based on element geometry
      const quantity = calculateElementQuantity(element, mesh);

      // Validate quantity
      if (quantity <= 0 || !isFinite(quantity)) {
        throw new Error('Invalid quantity calculated for element');
      }

      // A previously saved manual edit for this exact element wins over recalculating -
      // otherwise switching away and back (or a region/budget change re-running this)
      // would silently discard what the user typed in and saved.
      const saved = breakdownOverridesRef.current.get(element.id);
      if (saved) {
        setCostState({
          totalCost: saved.total,
          breakdown: saved,
          selectedElement: element,
          isCalculating: false,
          error: null
        });
        if (onCostUpdate) onCostUpdate(saved.total, saved);
        return;
      }

      // Calculate cost estimate
      const estimate = costEstimatorRef.current!.calculateElementCost(element, quantity, region);

      if (estimate && estimate.costBreakdown) {
        const newState = {
          totalCost: estimate.costBreakdown.total,
          breakdown: estimate.costBreakdown,
          selectedElement: element,
          isCalculating: false,
          error: null
        };

        setCostState(prev => newState);

        // Notify parent component
        if (onCostUpdate) {
          onCostUpdate(estimate.costBreakdown.total, estimate.costBreakdown);
        }
      } else {
        throw new Error('Cost estimation returned invalid result');
      }
    } catch (error) {
      console.error('Error calculating mesh cost:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during cost calculation';
      setCostState(prev => ({
        ...prev,
        isCalculating: false,
        error: errorMessage
      }));
    }
  }, [region, onCostUpdate]);

  // Calculate element quantity from mesh geometry
  const calculateElementQuantity = (element: BIMElement, mesh: BABYLON.AbstractMesh): number => {
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

    switch (element.type) {
      case 'wall':
        return size.y * size.z; // Height * Width (area for wall)
      case 'floor':
      case 'ceiling':
        return size.x * size.z; // Length * Width (area)
      case 'door':
      case 'window':
        return size.x * size.y; // Width * Height (area)
      case 'beam':
      case 'column':
        return size.x * size.y * size.z; // Volume
      default:
        // For generic elements, use volume
        return size.x * size.y * size.z;
    }
  };

  // Handle mesh selection changes
  useEffect(() => {
    // Switching elements mid-edit would otherwise leave a stale draft that gets saved
    // against whatever's newly selected instead of what it was actually edited for.
    setIsEditingBreakdown(false);
    setBreakdownDraft(null);
    if (selectedMesh) {
      calculateMeshCost(selectedMesh);
    } else {
      setCostState(prev => ({
        ...prev,
        totalCost: 0,
        breakdown: null,
        selectedElement: null,
        error: null
      }));
    }
  }, [selectedMesh, calculateMeshCost]);

  const startEditingBreakdown = () => {
    setBreakdownDraft({
      material: costState.breakdown?.material ?? 0,
      labor: costState.breakdown?.labor ?? 0,
      equipment: costState.breakdown?.equipment ?? 0,
      overhead: costState.breakdown?.overhead ?? 0,
      total: costState.totalCost ?? 0
    });
    setIsEditingBreakdown(true);
  };

  const cancelEditingBreakdown = () => {
    setIsEditingBreakdown(false);
    setBreakdownDraft(null);
  };

  // Editing a breakdown part keeps Total in sync as their sum (the normal case) - but
  // Total itself stays independently editable too, so typing directly into it (e.g. to
  // match a contractor's bottom-line quote without fussing over the split) overrides
  // that sum instead of being fought back to it.
  const updateDraftPart = (key: 'material' | 'labor' | 'equipment' | 'overhead', value: number) => {
    setBreakdownDraft(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      next.total = next.material + next.labor + next.equipment + next.overhead;
      return next;
    });
  };

  const saveEditedBreakdown = () => {
    if (!breakdownDraft || !costState.selectedElement) return;
    const savedBreakdown = { ...breakdownDraft };

    breakdownOverridesRef.current.set(costState.selectedElement.id, savedBreakdown);

    setCostState(prev => ({ ...prev, totalCost: savedBreakdown.total, breakdown: savedBreakdown }));
    setIsEditingBreakdown(false);
    setBreakdownDraft(null);

    if (onCostUpdate) onCostUpdate(savedBreakdown.total, savedBreakdown);
  };

  // Handle budget changes
  const handleBudgetChange = (newBudget: number) => {
    setBudget(newBudget);
    if (costEstimatorRef.current) {
      costEstimatorRef.current.setClientBudget(newBudget);
      // Recalculate if we have a selected element
      if (selectedMesh) {
        calculateMeshCost(selectedMesh);
      }
    }
  };

  // Handle region changes
  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    // Recalculate if we have a selected element
    if (selectedMesh) {
      calculateMeshCost(selectedMesh);
    }
  };

  const getBudgetStatus = () => {
    if (budget <= 0) return { status: 'no-budget', color: '#666', message: 'No budget set' };

    const percentage = (costState.totalCost / budget) * 100;
    if (percentage > 100) return { status: 'over', color: '#ff4444', message: 'Over Budget!' };
    if (percentage > 90) return { status: 'danger', color: '#ffaa00', message: 'Approaching Limit' };
    if (percentage > 75) return { status: 'warning', color: '#ffaa00', message: 'Getting High' };
    return { status: 'good', color: '#44aa44', message: 'Within Budget' };
  };

  const getProgressBarClass = (status: string) => {
    switch (status) {
      case 'over':
        return 'progressBarRed';
      case 'warning':
      case 'danger':
        return 'progressBarYellow';
      case 'good':
        return 'progressBarGreen';
      default:
        return 'progressBarGreen';
    }
  };

  const budgetStatus = getBudgetStatus();

  return (
    <div className={styles.costEstimatorContainer}>
      <h3 className={styles.costEstimatorHeader}>
        💰 Cost Estimator
        {costState.isCalculating && (
          <div className={styles.loadingSpinner}></div>
        )}
      </h3>

      {costState.error && (
        <div className={styles.errorMessage}>
          ⚠️ {costState.error}
        </div>
      )}

      {/* Show model-wide cost breakdown when no element is selected */}
      {!selectedMesh && modelCostData && (
        <div className={styles.modelCostSection}>
          <CostBreakdownSection costBreakdown={modelCostData} />
        </div>
      )}

      {/* Budget Settings */}
      <div className={styles.budgetSettings}>
        <div className={styles.budgetSettingRow}>
          <label htmlFor="budget-input" className={styles.budgetSettingLabel}>Project Budget:</label>
          <input
            id="budget-input"
            type="number"
            value={budget}
            onChange={(e) => handleBudgetChange(Number(e.target.value))}
            className={styles.budgetInput}
            min="0"
            step="1000"
            title="Project Budget"
            placeholder="Enter budget"
          />
        </div>

        <div className={styles.budgetSettingRow}>
          <label htmlFor="region-select" className={styles.budgetSettingLabel}>Region:</label>
          <select
            id="region-select"
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className={styles.regionSelect}
            title="Select Region"
          >
            <option value="US_East">US East</option>
            <option value="US_West">US West</option>
            <option value="Europe">Europe</option>
            <option value="Asia">Asia</option>
            <option value="India">India</option>
          </select>
        </div>
        <div className={styles.budgetSettingRow}>
          <label htmlFor="pdf-upload" className={styles.budgetSettingLabel}>Reference PDF:</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label htmlFor="pdf-upload" style={{ fontSize: 12, padding: '4px 8px', background: '#334155', borderRadius: 4, cursor: 'pointer' }}>
              {pdfFileName ? 'Replace' : 'Upload'}
            </label>
            <input id="pdf-upload" type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
            {pdfFileName && (
              <button
                type="button"
                onClick={() => setShowPdfPreview(v => !v)}
                style={{ fontSize: 12, padding: '4px 8px', background: showPdfPreview ? '#0ea5a5' : '#334155', borderRadius: 4, cursor: 'pointer', border: 'none', color: 'white' }}
              >
                {showPdfPreview ? 'Hide' : 'View'} PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cost Display */}
      {costState.selectedElement && (
        <div className={styles.elementInfo}>
          <div className={styles.elementName}>
            Selected: {costState.selectedElement.name}
          </div>
          <div className={styles.elementDetails}>
            Type: {costState.selectedElement.type} | Material: {costState.selectedElement.material}
          </div>
        </div>
      )}

      {/* Budget Status */}
      {budget > 0 && (
        <div className={styles.budgetStatus}>
          <div className={styles.budgetStatusRow}>
            <span>Budget Status:</span>
            <span className={
              budgetStatus.status === 'over' ? styles.budgetStatusOver :
              budgetStatus.status === 'warning' || budgetStatus.status === 'danger' ? styles.budgetStatusWarning :
              styles.budgetStatusGood
            }>
              {budgetStatus.message}
            </span>
          </div>
          <div className={styles.budgetProgressBarContainer}>
            <div
              className={`${styles.budgetProgressBar} ${styles[getProgressBarClass(budgetStatus.status)]}`}
              style={{ width: `${Math.min((costState.totalCost / budget) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Total Cost Display */}
      <div className={styles.totalCostContainer}>
        <span className={styles.totalCostLabel}>
          {costState.selectedElement ? 'Element Cost:' : 'Total Cost:'}
        </span>
        <span className={styles.totalCostValue}>
          {formatCost(costState.totalCost ?? 0)}
        </span>
      </div>

      {isIndia && (() => {
        const areaSqft = getBuiltUpAreaSqft();
        if (!areaSqft || !costState.totalCost) return null;
        const perSqft = (costState.totalCost * USD_TO_INR) / areaSqft;
        return (
          <div className={styles.totalCostContainer}>
            <span className={styles.totalCostLabel}>Approx. Rs./sq ft:</span>
            <span className={styles.totalCostValue}>
              ₹{perSqft.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span style={{ fontSize: '0.7em', opacity: 0.7 }}>({areaSqft.toFixed(0)} sq ft built-up)</span>
            </span>
          </div>
        );
      })()}
      {isIndia && (
        <p style={{ fontSize: '11px', opacity: 0.7, margin: '4px 0 8px' }}>
          Indicative India rates &amp; approximate USD→INR conversion - verify against local contractor quotes before budgeting.
        </p>
      )}

      {/* Cost Breakdown */}
      {costState.breakdown && (
        <div className={styles.costBreakdown}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 className={styles.breakdownHeader}>Cost Breakdown</h4>
            {costState.selectedElement && !isEditingBreakdown && (
              <button
                type="button"
                onClick={startEditingBreakdown}
                style={{ fontSize: 11, padding: '3px 8px', background: '#334155', borderRadius: 4, cursor: 'pointer', border: 'none', color: 'white' }}
              >
                Edit
              </button>
            )}
          </div>

          {isEditingBreakdown && breakdownDraft ? (
            <>
              <div style={{ fontSize: 10, opacity: 0.7, margin: '2px 0 6px' }}>
                Values below are in USD - the underlying stored currency, regardless of the display region above.
              </div>
              {(['material', 'labor', 'equipment', 'overhead'] as const).map((key) => (
                <div key={key} className={styles.breakdownItem} style={{ alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize' }}>{key}:</span>
                  <input
                    type="number"
                    value={breakdownDraft[key]}
                    min="0"
                    step="100"
                    onChange={(e) => updateDraftPart(key, Number(e.target.value))}
                    className={styles.budgetInput}
                    style={{ width: 100 }}
                    title={key}
                  />
                </div>
              ))}
              <li className={styles.costBreakdownTotal} style={{ listStyle: 'none', alignItems: 'center' }}>
                <span>Total:</span>
                <input
                  type="number"
                  value={breakdownDraft.total}
                  min="0"
                  step="100"
                  onChange={(e) => setBreakdownDraft(prev => prev && { ...prev, total: Number(e.target.value) })}
                  className={styles.budgetInput}
                  style={{ width: 100, fontWeight: 'bold' }}
                  title="total"
                />
              </li>
              <div style={{ fontSize: 10, opacity: 0.6, margin: '2px 0 0' }}>
                Total auto-fills as Material+Labor+Equipment+Overhead when you edit those - type into Total directly to override it independently (e.g. to match a quoted lump sum).
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={cancelEditingBreakdown}
                  style={{ fontSize: 11, padding: '4px 10px', background: '#334155', borderRadius: 4, cursor: 'pointer', border: 'none', color: 'white' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditedBreakdown}
                  style={{ fontSize: 11, padding: '4px 10px', background: '#0ea5a5', borderRadius: 4, cursor: 'pointer', border: 'none', color: 'white' }}
                >
                  Save
                </button>
              </div>
            </>
          ) : (
            <ul className={styles.breakdownList}>
              <li className={styles.breakdownItem}>
                <span>Material:</span>
                <span>{formatCost(costState.breakdown.material ?? 0)}</span>
              </li>
              <li className={styles.breakdownItem}>
                <span>Labor:</span>
                <span>{formatCost(costState.breakdown.labor ?? 0)}</span>
              </li>
              <li className={styles.breakdownItem}>
                <span>Equipment:</span>
                <span>{formatCost(costState.breakdown.equipment ?? 0)}</span>
              </li>
              <li className={styles.breakdownItem}>
                <span>Overhead:</span>
                <span>{formatCost(costState.breakdown.overhead ?? 0)}</span>
              </li>
            </ul>
          )}
        </div>
      )}

      {/* No selection message */}
      {!selectedMesh && !modelCostData && !costState.isCalculating && (
        <div className={styles.noSelectionMessage}>
          Select a mesh to see cost estimate or load a BIM model for project costs
        </div>
      )}

      {showPdfPreview && pdfUrl && (
        <div
          style={{
            position: 'fixed', top: 60, right: 340, width: 280, height: '70vh',
            background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
            zIndex: 49, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #334155' }}>
            <span style={{ fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pdfFileName ?? undefined}>
              {pdfFileName}
            </span>
            <button
              type="button"
              onClick={() => setShowPdfPreview(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
              aria-label="Close PDF preview"
            >
              ✕
            </button>
          </div>
          <iframe src={pdfUrl} title={pdfFileName ?? 'PDF preview'} style={{ flex: 1, border: 'none', width: '100%' }} />
        </div>
      )}
    </div>
  );
};

export default CostEstimatorWrapper;
