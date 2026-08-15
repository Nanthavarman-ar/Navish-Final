import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';

interface MaterialCost {
  name: string;
  baseCost: number; // Cost per square meter
  supplier: string;
  availability: 'high' | 'medium' | 'low';
  ecoRating: number; // 1-5 scale
  durability: number; // years
}

interface CostBreakdown {
  material: string;
  area: number;
  unitCost: number;
  totalCost: number;
  laborCost: number;
  totalWithLabor: number;
}

interface CostEstimatorProps {
  scene: BABYLON.Scene;
  selectedMesh?: BABYLON.AbstractMesh;
  onCostUpdate?: (totalCost: number) => void;
}

const CostEstimator: React.FC<CostEstimatorProps> = ({
  scene,
  selectedMesh,
  onCostUpdate
}) => {
  const [currentMaterial, setCurrentMaterial] = useState<string>('paint');
  const [selectedAlternative, setSelectedAlternative] = useState<string>('');
  const [totalBudget, setTotalBudget] = useState<number>(50000);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([]);
  const [showAlternatives, setShowAlternatives] = useState<boolean>(false);

  // Material database with costs and suppliers
  const materialCosts: MaterialCost[] = [
    { name: 'paint_standard', baseCost: 25, supplier: 'Home Depot', availability: 'high', ecoRating: 2, durability: 5 },
    { name: 'paint_premium', baseCost: 45, supplier: 'Sherwin Williams', availability: 'high', ecoRating: 3, durability: 8 },
    { name: 'paint_eco', baseCost: 35, supplier: 'Benjamin Moore', availability: 'medium', ecoRating: 4, durability: 7 },
    { name: 'wood_oak', baseCost: 120, supplier: 'Lumber Liquidators', availability: 'high', ecoRating: 3, durability: 20 },
    { name: 'wood_bamboo', baseCost: 85, supplier: 'Eco Woods', availability: 'medium', ecoRating: 5, durability: 15 },
    { name: 'wood_reclaimed', baseCost: 95, supplier: 'Reclaimed Wood Co', availability: 'low', ecoRating: 4, durability: 25 },
    { name: 'tile_ceramic', baseCost: 8, supplier: 'Tile Warehouse', availability: 'high', ecoRating: 3, durability: 30 },
    { name: 'tile_porcelain', baseCost: 12, supplier: 'Flooring Direct', availability: 'high', ecoRating: 3, durability: 35 },
    { name: 'carpet_standard', baseCost: 6, supplier: 'Carpet One', availability: 'high', ecoRating: 2, durability: 8 },
    { name: 'carpet_eco', baseCost: 9, supplier: 'Green Carpet Co', availability: 'medium', ecoRating: 4, durability: 10 },
  ];

  // Calculate surface area of selected mesh
  const calculateSurfaceArea = (mesh: BABYLON.AbstractMesh): number => {
    if (mesh instanceof BABYLON.Mesh) {
      // Simple approximation - in real implementation, you'd calculate actual surface area
      const boundingInfo = mesh.getBoundingInfo();
      const size = boundingInfo.maximum.subtract(boundingInfo.minimum);
      return (size.x * size.y + size.x * size.z + size.y * size.z) * 2; // Rough surface area
    }
    return 100; // Default fallback
  };

  // Get smart alternatives for current material
  const getSmartAlternatives = (currentMat: string): MaterialCost[] => {
    const current = materialCosts.find(m => m.name === currentMat);
    if (!current) return [];

    return materialCosts.filter(m => {
      const category = m.name.split('_')[0];
      const currentCategory = currentMat.split('_')[0];
      return category === currentCategory && m.name !== currentMat;
    }).sort((a, b) => {
      // Prioritize eco-friendly and cost-effective alternatives
      const aScore = (a.ecoRating * 2) - (a.baseCost / current.baseCost);
      const bScore = (b.ecoRating * 2) - (b.baseCost / current.baseCost);
      return bScore - aScore;
    });
  };

  // Calculate cost breakdown
  const calculateCosts = () => {
    if (!selectedMesh) return;

    const area = calculateSurfaceArea(selectedMesh);
    const currentMat = materialCosts.find(m => m.name === currentMaterial);
    const alternativeMat = materialCosts.find(m => m.name === selectedAlternative);

    const breakdowns: CostBreakdown[] = [];

    if (currentMat) {
      const laborMultiplier = 0.3; // 30% labor cost
      const totalCost = currentMat.baseCost * area;
      const laborCost = totalCost * laborMultiplier;

      breakdowns.push({
        material: currentMat.name,
        area,
        unitCost: currentMat.baseCost,
        totalCost,
        laborCost,
        totalWithLabor: totalCost + laborCost
      });
    }

    if (alternativeMat && selectedAlternative) {
      const laborMultiplier = 0.3;
      const totalCost = alternativeMat.baseCost * area;
      const laborCost = totalCost * laborMultiplier;

      breakdowns.push({
        material: alternativeMat.name,
        area,
        unitCost: alternativeMat.baseCost,
        totalCost,
        laborCost,
        totalWithLabor: totalCost + laborCost
      });
    }

    setCostBreakdown(breakdowns);

    // Notify parent of total cost update
    const totalProjectCost = breakdowns.reduce((sum, item) => sum + item.totalWithLabor, 0);
    if (onCostUpdate) {
      onCostUpdate(totalProjectCost);
    }
  };

  useEffect(() => {
    calculateCosts();
  }, [selectedMesh, currentMaterial, selectedAlternative]);

  const getBudgetStatus = () => {
    const totalCost = costBreakdown.reduce((sum, item) => sum + item.totalWithLabor, 0);
    const remaining = totalBudget - totalCost;
    const percentage = (totalCost / totalBudget) * 100;

    if (percentage > 90) return { status: 'danger', color: '#ff4444', message: 'Over Budget!' };
    if (percentage > 75) return { status: 'warning', color: '#ffaa00', message: 'Approaching Limit' };
    return { status: 'good', color: '#44aa44', message: 'Within Budget' };
  };

  const budgetStatus = getBudgetStatus();

  return (
    <div className="absolute top-15 right-2.5 w-80 bg-black bg-opacity-90 rounded-lg p-4 text-white text-xs z-[1000]">
      <h3 className="m-0 mb-4 text-green-500">💰 Cost Estimator</h3>

      {/* Budget Overview */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span>Budget:</span>
          <span>${totalBudget.toLocaleString()}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Current Cost:</span>
          <span style={{ color: budgetStatus.color }}>
            ${costBreakdown.reduce((sum, item) => sum + item.totalWithLabor, 0).toLocaleString()}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded overflow-hidden mt-1">
          <div 
            className="h-full transition-all duration-300 ease-in-out"
            style={{
              width: `${Math.min((costBreakdown.reduce((sum, item) => sum + item.totalWithLabor, 0) / totalBudget) * 100, 100)}%`,
              backgroundColor: budgetStatus.color
            }}
          />
        </div>
        <div className="text-xs mt-1" style={{ color: budgetStatus.color }}>
          {budgetStatus.message}
        </div>
      </div>

      {/* Current Material */}
      <div className="mb-4">
        <label htmlFor="current-material" className="block mb-1">Current Material:</label>
        <select
          id="current-material"
          value={currentMaterial}
          onChange={(e) => setCurrentMaterial(e.target.value)}
          className="w-full p-1 bg-gray-700 text-white border border-gray-600 rounded"
        >
          {materialCosts.map(mat => (
            <option key={mat.name} value={mat.name}>
              {mat.name.replace('_', ' ').toUpperCase()} - ${mat.baseCost}/m²
            </option>
          ))}
        </select>
      </div>

      {/* Smart Alternatives */}
      <div className="mb-4">
        <button
          onClick={() => setShowAlternatives(!showAlternatives)}
          className="w-full p-2 bg-green-500 text-white border-0 rounded cursor-pointer mb-2"
        >
          🧠 Smart Alternatives
        </button>

        {showAlternatives && (
          <div className="max-h-48 overflow-y-auto">
            {getSmartAlternatives(currentMaterial).map(alt => (
              <div
                key={alt.name}
                onClick={() => setSelectedAlternative(alt.name)}
                className={`p-2 mb-1 rounded cursor-pointer border border-gray-600 ${
                  selectedAlternative === alt.name ? 'bg-green-500' : 'bg-gray-700'
                }`}
              >
                <div className="font-bold">
                  {alt.name.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-xs text-gray-300">
                  ${alt.baseCost}/m² • Eco: {alt.ecoRating}/5 • Durability: {alt.durability}yrs
                </div>
                <div 
                  className="text-xs"
                  style={{ 
                    color: alt.availability === 'high' ? '#4CAF50' : 
                           alt.availability === 'medium' ? '#ffaa00' : '#ff4444' 
                  }}
                >
                  {alt.supplier} • {alt.availability} availability
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      {costBreakdown.length > 0 && (
        <div>
          <h4 className="my-2 text-green-500">Cost Breakdown</h4>
          {costBreakdown.map((item, index) => (
            <div key={index} className="p-2 mb-2 bg-gray-700 rounded border border-gray-600">
              <div className="font-bold mb-1">
                {item.material.replace('_', ' ').toUpperCase()}
              </div>
              <div className="text-xs text-gray-300">
                Area: {item.area.toFixed(1)}m² • Unit: ${item.unitCost}/m²
              </div>
              <div className="text-xs text-gray-300">
                Material: ${item.totalCost.toFixed(0)} • Labor: ${item.laborCost.toFixed(0)}
              </div>
              <div className="text-xs font-bold text-green-500">
                Total: ${item.totalWithLabor.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CostEstimator;
