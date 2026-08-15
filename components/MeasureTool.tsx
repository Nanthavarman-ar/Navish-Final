import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Engine, Scene, Mesh, AbstractMesh, Vector3, MeshBuilder, StandardMaterial, Color3, LinesMesh, VertexBuffer, DynamicTexture } from '@babylonjs/core';

interface MeasureToolProps {
  scene: Scene;
  engine: Engine;
  isActive: boolean;
  onMeasurementComplete?: (measurement: Measurement) => void;
}

type UnitType = 'meters' | 'feet' | 'inches' | 'mm';

type ValueType = 'linear' | 'area' | 'volume' | 'angle';

interface Measurement {
  id: string;
  type: 'distance' | 'area' | 'angle' | 'length' | 'breadth' | 'depth' | 'volume' | 'circumference' | 'radius';
  points: Vector3[];
  valueMeters: number;  // Raw value: meters (linear), m² (area), m³ (volume), degrees (angle)
  valueType: ValueType;
  label: string;
}

interface MeasurementPoint {
  position: Vector3;
  mesh: Mesh;
}

const MeasureTool: React.FC<MeasureToolProps> = ({
  scene,
  engine,
  isActive,
  onMeasurementComplete
}) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [currentPoints, setCurrentPoints] = useState<MeasurementPoint[]>([]);
  const [measurementMode, setMeasurementMode] = useState<'distance' | 'area' | 'angle' | 'length' | 'breadth' | 'depth' | 'volume' | 'circumference' | 'radius'>('distance');
  const [unit, setUnit] = useState<UnitType>('meters');
  // Scene scale: 1 Babylon unit = ? meters. Default 1 unit = 1m. Use 0.01 for cm, 0.001 for mm.
  const [sceneScale, setSceneScale] = useState<number>(1);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const previewLineRef = useRef<LinesMesh | null>(null);
  const [autoSnap, setAutoSnap] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{ name: string; position: string; snapType?: string } | null>(null);
  const [livePreview, setLivePreview] = useState<string | null>(null);
  const labelMeshesRef = useRef<Mesh[]>([]);
  const measurementMeshesRef = useRef<Map<string, Mesh[]>>(new Map());
  const measurementIdCounter = useRef(0);
  const currentPointsRef = useRef<MeasurementPoint[]>([]);
  currentPointsRef.current = currentPoints;

  const getCanvasCoords = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = engine.getRenderingCanvas() as HTMLCanvasElement | null;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, [engine]);

  type SnapType = 'vertex' | 'midpoint' | 'face';

  const snapToGeometry = useCallback((pickInfo: { pickedPoint: Vector3; pickedMesh?: AbstractMesh | null }): { point: Vector3; type: SnapType } => {
    if (!autoSnap || !pickInfo.pickedMesh) return { point: pickInfo.pickedPoint.clone(), type: 'face' };
    const mesh = pickInfo.pickedMesh as Mesh;
    const worldMat = mesh.getWorldMatrix();
    const pt = pickInfo.pickedPoint;
    // A fixed 0.35-unit radius is imperceptibly tiny next to a real building
    // (often tens of units across), so snapping almost never triggered in
    // practice - scale it to the actual picked mesh's size instead.
    const meshExtent = mesh.getBoundingInfo().boundingBox.extendSizeWorld;
    const meshDiagonal = Math.max(meshExtent.x, meshExtent.y, meshExtent.z) * 2;
    const snapRadius = Math.max(0.05, Math.min(2, meshDiagonal * 0.03));
    let bestVert = pt.clone();
    let bestVertDist = Infinity;
    let bestMid = pt.clone();
    let bestMidDist = Infinity;

    const positions = mesh.getVerticesData?.(VertexBuffer.PositionKind);
    const indices = mesh.getIndices?.();
    if (!positions || positions.length < 3) return { point: pt.clone(), type: 'face' };

    const verts: Vector3[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      verts.push(Vector3.TransformCoordinates(new Vector3(positions[i], positions[i + 1], positions[i + 2]), worldMat));
    }
    for (let i = 0; i < verts.length; i++) {
      const d = Vector3.Distance(verts[i], pt);
      if (d < bestVertDist) { bestVertDist = d; bestVert = verts[i].clone(); }
    }
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
        for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]] as [number, number][]) {
          const mid = verts[a].add(verts[b]).scale(0.5);
          const d = Vector3.Distance(mid, pt);
          if (d < bestMidDist) { bestMidDist = d; bestMid = mid.clone(); }
        }
      }
    }
    if (bestVertDist < snapRadius) return { point: bestVert, type: 'vertex' };
    if (bestMidDist < snapRadius * 1.5) return { point: bestMid, type: 'midpoint' };
    if (bestVertDist < bestMidDist && bestVertDist < snapRadius * 3) return { point: bestVert, type: 'vertex' };
    if (bestMidDist < snapRadius * 3) return { point: bestMid, type: 'midpoint' };
    return { point: pt.clone(), type: 'face' };
  }, [autoSnap]);

  useEffect(() => {
    if (isActive) {
      scene.meshes.filter(m => m.name && m.name.startsWith('preview_line')).forEach(m => { try { m.dispose(); } catch (_) { /* ignore dispose errors */ } });
      previewLineRef.current = null;
      setupMouseEvents();
    } else {
      cleanupMouseEvents();
      clearPreview();
      setHoverInfo(null);
    }
    return () => {
      cleanupMouseEvents();
      clearPreview();
    };
  }, [isActive, measurementMode]);

  useEffect(() => {
    if (measurements.length === 0) return;
    const M_TO: Record<UnitType, number> = { meters: 1, feet: 3.28084, inches: 39.3701, mm: 1000 };
    const fmt = (v: number) => {
      const val = v * M_TO[unit];
      const s = unit === 'meters' ? 'm' : unit === 'feet' ? 'ft' : unit === 'inches' ? 'in' : 'mm';
      return unit === 'mm' ? `${val.toFixed(2)} mm` : `${val.toFixed(4)} ${s}`;
    };
    const map = new Map(measurements.map(m => [m.id, m]));
    scene.meshes.forEach(mesh => {
      if (!mesh.name || !mesh.name.endsWith('_label')) return;
      const id = mesh.name.replace(/_label$/, '');
      const m = map.get(id);
      if (!m || m.valueType !== 'linear') return;
      if (!mesh.material) return;
      const mat = mesh.material as StandardMaterial;
      const dt = mat.diffuseTexture as DynamicTexture | undefined;
      if (!dt || typeof dt.getContext !== 'function') return;
      const text = fmt(m.valueMeters);
      const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.font = 'bold 28px Arial';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(text, 128, 32);
      ctx.fillStyle = '#88aa88';
      ctx.fillText(text, 128, 32);
      dt.update();
    });
  }, [unit, measurements, scene]);

  const meshFilter = (m: AbstractMesh) => !m.name || (!m.name.startsWith('measure_') && !m.name.startsWith('preview_') && !m.name.startsWith('measurement_'));

  const setupMouseEvents = () => {
    const canvas = engine.getRenderingCanvas();
    if (!canvas) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!isActive || event.button !== 0) return;
      if ((event.target as Node) !== canvas) return;
      const { x, y } = getCanvasCoords(event);
      const pickInfo = scene.pick(x, y, meshFilter);
      if (pickInfo.hit && pickInfo.pickedPoint) {
        const snapped = snapToGeometry({ pickedPoint: pickInfo.pickedPoint, pickedMesh: pickInfo.pickedMesh });
        addMeasurementPoint(snapped.point);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isActive || (event.target as Node) !== canvas) {
        setHoverInfo(null);
        setLivePreview(null);
        return;
      }
      const { x, y } = getCanvasCoords(event);
      const pickInfo = scene.pick(x, y, meshFilter);
      const pts = currentPointsRef.current;
      const needsLive = pts.length === 1 && (measurementMode === 'distance' || measurementMode === 'length' || measurementMode === 'breadth' || measurementMode === 'depth');
      if (pickInfo.hit && pickInfo.pickedPoint) {
        const snapped = snapToGeometry({ pickedPoint: pickInfo.pickedPoint, pickedMesh: pickInfo.pickedMesh });
        const pos = snapped.point;
        const snapLabel = snapped.type === 'vertex' ? 'Vertex' : snapped.type === 'midpoint' ? 'Midpoint' : 'Face';
        setHoverInfo({
          name: pickInfo.pickedMesh?.name || 'Object',
          position: `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
          snapType: snapLabel
        });
        if (needsLive) {
          const dist = Vector3.Distance(pts[0].position, pos) * sceneScale;
          const v = dist * (unit === 'meters' ? 1 : unit === 'feet' ? 3.28084 : unit === 'inches' ? 39.3701 : 1000);
          const suffix = unit === 'meters' ? 'm' : unit === 'feet' ? 'ft' : unit === 'inches' ? 'in' : 'mm';
          setLivePreview(`${v.toFixed(4)} ${suffix}`);
          updatePreviewLine(pts, pos);
        } else {
          setLivePreview(null);
        }
      } else {
        setHoverInfo(null);
        setLivePreview(null);
        if (currentPointsRef.current.length === 1) clearPreview();
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown, true);
    canvas.addEventListener('pointermove', handlePointerMove, true);

    (canvas as any)._measureToolCleanup = () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, true);
      canvas.removeEventListener('pointermove', handlePointerMove, true);
    };
  };

  const cleanupMouseEvents = () => {
    const canvas = engine.getRenderingCanvas();
    if (canvas && (canvas as any)._measureToolCleanup) {
      (canvas as any)._measureToolCleanup();
    }
  };

  const addMeasurementPoint = (position: Vector3) => {
    const pts = currentPointsRef.current;
    const pointMesh = MeshBuilder.CreateSphere(`measure_point_${Date.now()}_${pts.length}`, { diameter: 0.08 }, scene);
    pointMesh.position = position;

    const material = new StandardMaterial(`point_mat_${Date.now()}_${currentPoints.length}`, scene);
    material.diffuseColor = new Color3(1, 0, 0);
    material.emissiveColor = new Color3(0.5, 0, 0);
    pointMesh.material = material;

    const newPoint: MeasurementPoint = { position, mesh: pointMesh };
    const updatedPoints = [...pts, newPoint];
    setCurrentPoints(updatedPoints);

    // Update preview line
    updatePreviewLine(updatedPoints);

    // Check if measurement is complete
    if ((measurementMode === 'distance' || measurementMode === 'length' || measurementMode === 'breadth' || measurementMode === 'depth') && updatedPoints.length === 2) {
      completeMeasurement(updatedPoints);
    } else if (measurementMode === 'area' && updatedPoints.length >= 3) {
      // For area, user can add more points or complete manually
      setIsMeasuring(true);
    } else if (measurementMode === 'angle' && updatedPoints.length === 3) {
      completeMeasurement(updatedPoints);
    } else if ((measurementMode === 'circumference' || measurementMode === 'radius') && updatedPoints.length === 2) {
      completeMeasurement(updatedPoints);
    } else if (measurementMode === 'volume' && updatedPoints.length === 8) {
      completeMeasurement(updatedPoints);
    }
  };

  const updatePreviewLine = (points: MeasurementPoint[], cursorPos?: Vector3) => {
    const positions: Vector3[] = points.map(p => p.position);
    if (cursorPos && points.length === 1) {
      positions.push(cursorPos);
    } else if (measurementMode === 'area' && points.length >= 2) {
      const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
      if (pickInfo.hit && pickInfo.pickedPoint) positions.push(pickInfo.pickedPoint);
    }
    if (positions.length < 2) {
      clearPreview();
      return;
    }

    const existing = previewLineRef.current;
    if (existing && !existing.isDisposed) {
      MeshBuilder.CreateLines('preview_line', { points: positions, instance: existing }, scene);
      return;
    }
    clearPreview();
    const lines = MeshBuilder.CreateLines('preview_line', { points: positions, updatable: true }, scene);
    const material = new StandardMaterial('preview_mat', scene);
    material.diffuseColor = new Color3(1, 1, 0);
    material.alpha = 0.7;
    material.wireframe = false;
    lines.material = material;
    previewLineRef.current = lines;
  };

  const clearPreview = () => {
    const line = previewLineRef.current;
    if (line) {
      line.dispose();
      previewLineRef.current = null;
    }
  };

  const formatLinearForViewport = (valueMeters: number): string => {
    const v = valueMeters * (unit === 'meters' ? 1 : unit === 'feet' ? 3.28084 : unit === 'inches' ? 39.3701 : 1000);
    const suffix = unit === 'meters' ? 'm' : unit === 'feet' ? 'ft' : unit === 'inches' ? 'in' : 'mm';
    return unit === 'mm' ? `${v.toFixed(2)} mm` : `${v.toFixed(4)} ${suffix}`;
  };

  const createDistanceLabel = (p1: Vector3, p2: Vector3, valueMeters: number, id: string) => {
    const text = formatLinearForViewport(valueMeters);
    const mid = p1.add(p2).scale(0.5);
    const dist = Vector3.Distance(p1, p2);
    const dir = p2.subtract(p1).normalize();
    let perp = Vector3.Cross(dir, Vector3.Up());
    if (perp.lengthSquared() < 0.001) perp = Vector3.Cross(dir, Vector3.Right());
    perp = perp.normalize();
    const offset = 0.2 + Math.min(0.4, dist * 0.15);
    const labelPos = mid.add(perp.scale(offset));
    const size = Math.max(0.2, Math.min(1.2, dist * 0.25 + 0.2));
    const plane = MeshBuilder.CreatePlane(`${id}_label`, { size }, scene);
    plane.position = labelPos;
    const dt = new DynamicTexture(`${id}_tex`, { width: 256, height: 64 }, scene, false);
    dt.hasAlpha = true;
    const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 28px Arial';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, 128, 32);
    ctx.fillStyle = '#88aa88';
    ctx.fillText(text, 128, 32);
    dt.update();
    const mat = new StandardMaterial(`${id}_labelMat`, scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false;
    mat.wireframe = false;
    mat.depthFunction = Engine.ALWAYS;
    mat.disableDepthWrite = true;
    plane.material = mat;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.renderingGroupId = 1;
    if (typeof plane.disableEdgesRendering === 'function') plane.disableEdgesRendering();
    labelMeshesRef.current.push(plane);
  };

  const completeMeasurement = (points: MeasurementPoint[]) => {
    if (points.length < 2 && (measurementMode === 'distance' || measurementMode === 'length' || measurementMode === 'breadth' || measurementMode === 'depth' || measurementMode === 'circumference' || measurementMode === 'radius')) return;
    if (points.length < 3 && (measurementMode === 'area' || measurementMode === 'angle')) return;
    if (points.length < 8 && measurementMode === 'volume') return;

    const measurement = createMeasurement(points);
    setMeasurements(prev => [...prev, measurement]);

    points.forEach(point => point.mesh.dispose());
    setCurrentPoints([]);
    clearPreview();
    setIsMeasuring(false);

    if (onMeasurementComplete) onMeasurementComplete(measurement);
  };

  const createMeasurement = (points: MeasurementPoint[]): Measurement => {
    const id = `measurement_${measurementIdCounter.current++}`;
    let valueMeters = 0;
    let valueType: ValueType = 'linear';
    const meshesForId: Mesh[] = [];

    if (measurementMode === 'distance' && points.length === 2) {
      valueMeters = Vector3.Distance(points[0].position, points[1].position) * sceneScale;
      valueType = 'linear';
      const lines = MeshBuilder.CreateLines(`${id}_line`, { points: points.map(p => p.position) }, scene);
      const mat = new StandardMaterial(`${id}_mat`, scene);
      mat.diffuseColor = new Color3(0, 0.4, 0);
      mat.wireframe = false;
      lines.material = mat;
      meshesForId.push(lines);

    } else if (measurementMode === 'area' && points.length >= 3) {
      valueMeters = calculatePolygonArea(points.map(p => p.position)) * sceneScale * sceneScale;
      valueType = 'area';
      const areaPoints = [...points.map(p => p.position), points[0].position];
      const areaLines = MeshBuilder.CreateLines(`${id}_area`, { points: areaPoints }, scene);
      const mat = new StandardMaterial(`${id}_mat`, scene);
      mat.diffuseColor = new Color3(0, 0, 1);
      mat.alpha = 0.8;
      mat.wireframe = false;
      areaLines.material = mat;
      meshesForId.push(areaLines);

    } else if (measurementMode === 'angle' && points.length === 3) {
      const v1 = points[0].position.subtract(points[1].position);
      const v2 = points[2].position.subtract(points[1].position);
      const normal = v1.cross(v2).normalize();
      valueMeters = Vector3.GetAngleBetweenVectors(v1, v2, normal) * 180 / Math.PI;
      valueType = 'angle';

    } else if ((measurementMode === 'length' || measurementMode === 'breadth' || measurementMode === 'depth') && points.length === 2) {
      valueMeters = Vector3.Distance(points[0].position, points[1].position) * sceneScale;
      valueType = 'linear';
      const lines = MeshBuilder.CreateLines(`${id}_line`, { points: points.map(p => p.position) }, scene);
      const mat = new StandardMaterial(`${id}_mat`, scene);
      mat.diffuseColor = new Color3(0, 0.4, 0);
      mat.wireframe = false;
      lines.material = mat;
      meshesForId.push(lines);
    } else if ((measurementMode === 'circumference' || measurementMode === 'radius') && points.length === 2) {
      const radius = Vector3.Distance(points[0].position, points[1].position) * sceneScale;
      valueMeters = measurementMode === 'radius' ? radius : 2 * Math.PI * radius;
      valueType = 'linear';
      const lines = MeshBuilder.CreateLines(`${id}_line`, { points: points.map(p => p.position) }, scene);
      const mat = new StandardMaterial(`${id}_mat`, scene);
      mat.diffuseColor = new Color3(0, 0.4, 0);
      mat.wireframe = false;
      lines.material = mat;
      meshesForId.push(lines);

    } else if (measurementMode === 'volume' && points.length === 8) {
      valueMeters = calculateBoundingBoxVolume(points.map(p => p.position)) * sceneScale * sceneScale * sceneScale;
      valueType = 'volume';
      const boxLines = createBoundingBoxLines(points.map(p => p.position), scene, id);
      const mat = new StandardMaterial(`${id}_mat`, scene);
      mat.diffuseColor = new Color3(1, 0, 1);
      mat.alpha = 0.8;
      mat.wireframe = false;
      boxLines.forEach(line => { line.material = mat; meshesForId.push(line); });
    }

    measurementMeshesRef.current.set(id, meshesForId);

    const m: Measurement = { id, type: measurementMode, points: points.map(p => p.position), valueMeters, valueType, label: '' };
    m.label = formatValue(m);
    if (valueType === 'linear' && points.length === 2 && measurementMode !== 'circumference' && measurementMode !== 'radius') {
      createDistanceLabel(points[0].position, points[1].position, valueMeters, id);
    } else if ((measurementMode === 'radius' || measurementMode === 'circumference') && points.length === 2) {
      const radius = Vector3.Distance(points[0].position, points[1].position) * sceneScale;
      createDistanceLabel(points[0].position, points[1].position, measurementMode === 'radius' ? radius : 2 * Math.PI * radius, id);
    }
    const labelMeshes = labelMeshesRef.current.filter(x => x.name && x.name.startsWith(id));
    labelMeshes.forEach(lm => meshesForId.push(lm));
    measurementMeshesRef.current.set(id, meshesForId);
    return m;
  };

  const calculatePolygonArea = (points: Vector3[]): number => {
    if (points.length < 3) return 0;
    const n = points.length;
    let crossSum = Vector3.Zero();
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      crossSum = crossSum.add(Vector3.Cross(points[i], points[j]));
    }
    return 0.5 * crossSum.length();
  };

  const calculateBoundingBoxVolume = (points: Vector3[]): number => {
    if (points.length < 8) return 0;

    // Find min and max coordinates
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;

    return width * height * depth;
  };

  const createBoundingBoxLines = (points: Vector3[], scene: Scene, id: string): LinesMesh[] => {
    if (points.length < 8) return [];

    // Find min and max coordinates
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    });

    // Create the 8 corners of the bounding box
    const corners = [
      new Vector3(minX, minY, minZ),
      new Vector3(maxX, minY, minZ),
      new Vector3(maxX, maxY, minZ),
      new Vector3(minX, maxY, minZ),
      new Vector3(minX, minY, maxZ),
      new Vector3(maxX, minY, maxZ),
      new Vector3(maxX, maxY, maxZ),
      new Vector3(minX, maxY, maxZ)
    ];

    // Create lines for the bounding box edges
    const lines: LinesMesh[] = [];

    // Bottom face
    lines.push(MeshBuilder.CreateLines(`${id}_bottom`, {
      points: [corners[0], corners[1], corners[2], corners[3], corners[0]]
    }, scene));

    // Top face
    lines.push(MeshBuilder.CreateLines(`${id}_top`, {
      points: [corners[4], corners[5], corners[6], corners[7], corners[4]]
    }, scene));

    // Vertical edges
    lines.push(MeshBuilder.CreateLines(`${id}_vert1`, { points: [corners[0], corners[4]] }, scene));
    lines.push(MeshBuilder.CreateLines(`${id}_vert2`, { points: [corners[1], corners[5]] }, scene));
    lines.push(MeshBuilder.CreateLines(`${id}_vert3`, { points: [corners[2], corners[6]] }, scene));
    lines.push(MeshBuilder.CreateLines(`${id}_vert4`, { points: [corners[3], corners[7]] }, scene));

    return lines;
  };

  const clearAllMeasurements = () => {
    measurementMeshesRef.current.forEach(meshes => {
      meshes.forEach(m => { try { m.dispose(); } catch (_) { /* ignore dispose errors */ } });
    });
    measurementMeshesRef.current.clear();
    labelMeshesRef.current = [];
    setMeasurements([]);
    currentPoints.forEach(point => { try { point.mesh.dispose(); } catch (_) { /* ignore dispose errors */ } });
    setCurrentPoints([]);
    clearPreview();
    setLivePreview(null);
    setIsMeasuring(false);
  };

  const deleteMeasurement = (id: string) => {
    const meshes = measurementMeshesRef.current.get(id);
    if (meshes) {
      meshes.forEach(m => { try { m.dispose(); } catch (_) { /* ignore dispose errors */ } });
      measurementMeshesRef.current.delete(id);
    }
    labelMeshesRef.current = labelMeshesRef.current.filter(m => {
      if (m.name && m.name.startsWith(id)) { try { m.dispose(); } catch (_) { /* ignore dispose errors */ }; return false; }
      return true;
    });
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };

  const M_TO: Record<UnitType, number> = { meters: 1, feet: 3.28084, inches: 39.3701, mm: 1000 };

  const formatValue = (m: Measurement): string => {
    if (m.valueType === 'angle') return `${m.valueMeters.toFixed(2)}°`;
    const u = unit;
    if (m.valueType === 'linear') {
      const v = m.valueMeters * M_TO[u];
      return u === 'mm' ? `${v.toFixed(2)} mm` : `${v.toFixed(4)} ${u === 'meters' ? 'm' : u === 'feet' ? 'ft' : u === 'inches' ? 'in' : 'mm'}`;
    }
    if (m.valueType === 'area') {
      const v = m.valueMeters * Math.pow(M_TO[u], 2);
      return u === 'mm' ? `${v.toFixed(2)} mm²` : `${v.toFixed(4)} ${u === 'meters' ? 'm' : u === 'feet' ? 'ft' : u === 'inches' ? 'in' : 'mm'}²`;
    }
    if (m.valueType === 'volume') {
      const v = m.valueMeters * Math.pow(M_TO[u], 3);
      return u === 'mm' ? `${v.toFixed(2)} mm³` : `${v.toFixed(4)} ${u === 'meters' ? 'm' : u === 'feet' ? 'ft' : u === 'inches' ? 'in' : 'mm'}³`;
    }
    return String(m.valueMeters);
  };

  const getMinPointsForMode = (mode: string): number => {
    switch (mode) {
      case 'distance':
      case 'length':
      case 'breadth':
      case 'depth':
      case 'circumference':
      case 'radius':
        return 2;
      case 'angle':
        return 3;
      case 'area':
        return 3;
      case 'volume':
        return 8;
      default:
        return 2;
    }
  };

  const exportMeasurements = () => {
    const data = {
      measurements: measurements.map(m => ({
        ...m,
        points: m.points.map(p => ({ x: p.x, y: p.y, z: p.z }))
      })),
      exportDate: new Date().toISOString(),
      totalMeasurements: measurements.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="text-slate-100 flex flex-col gap-2">
      {/* Controls */}
      <div className="mb-4">
        <div className="mb-2">
          <label htmlFor="measurement-type" className="block text-xs text-slate-400 mb-1">
            Measurement Type
          </label>
          <select
            id="measurement-type"
            value={measurementMode}
            onChange={(e) => {
              setMeasurementMode(e.target.value as any);
              clearAllMeasurements();
            }}
            className="w-full p-1 bg-slate-600 border border-slate-500 rounded text-slate-100 text-xs"
          >
          <option value="distance">Distance</option>
          <option value="area">Area</option>
          <option value="angle">Angle</option>
          <option value="length">Length</option>
          <option value="breadth">Breadth</option>
          <option value="depth">Depth</option>
          <option value="volume">Volume</option>
          <option value="circumference">Circumference</option>
          <option value="radius">Radius</option>
        </select>
        </div>

        <div className="mb-2">
          <label htmlFor="unit-select" className="block text-xs text-slate-400 mb-1">
            Display Unit
          </label>
          <select
            id="unit-select"
            value={unit}
            onChange={(e) => setUnit(e.target.value as any)}
            className="w-full p-2 bg-slate-600 border border-slate-500 rounded text-slate-100 text-xs"
          >
            <option value="meters">Meters (m)</option>
            <option value="mm">Millimeters (mm)</option>
            <option value="feet">Feet (ft)</option>
            <option value="inches">Inches (in)</option>
          </select>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="text-xs text-slate-400">Auto Snap to vertices</label>
          <button
            type="button"
            onClick={() => setAutoSnap(!autoSnap)}
            className={`px-3 py-1 rounded text-xs font-medium ${autoSnap ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-400'}`}
          >
            {autoSnap ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="mb-2">
          <label htmlFor="scale-select" className="block text-xs text-slate-400 mb-1">
            Scene scale (1 unit = ?)
          </label>
          <select
            id="scale-select"
            value={sceneScale}
            onChange={(e) => setSceneScale(parseFloat(e.target.value))}
            className="w-full p-2 bg-slate-600 border border-slate-500 rounded text-slate-100 text-xs"
          >
            <option value={1}>1 unit = 1 m</option>
            <option value={0.01}>1 unit = 1 cm</option>
            <option value={0.001}>1 unit = 1 mm</option>
          </select>
        </div>

        <div className="flex gap-1 mb-2">
          <button
            onClick={() => completeMeasurement(currentPoints)}
            disabled={!isMeasuring || currentPoints.length < getMinPointsForMode(measurementMode)}
            className={`flex-1 px-1.5 py-1.5 border-0 rounded text-white text-xs ${
              isMeasuring && currentPoints.length >= getMinPointsForMode(measurementMode)
                ? 'bg-emerald-500 cursor-pointer opacity-100'
                : 'bg-emerald-500 cursor-not-allowed opacity-50'
            }`}
          >
            Complete
          </button>

          <button
            onClick={clearAllMeasurements}
            className="flex-1 px-1.5 py-1.5 bg-red-500 border-0 rounded text-white text-xs cursor-pointer"
          >
            Clear All
          </button>
        </div>

        {measurements.length > 0 && (
          <button
            onClick={exportMeasurements}
            className="w-full px-1.5 py-1.5 bg-blue-500 border-0 rounded text-white text-xs cursor-pointer"
          >
            Export Measurements
          </button>
        )}
      </div>

      {/* Hover - object identification + snap type (SketchUp-style) */}
      {hoverInfo && (
        <div className="mb-3 px-3 py-2 bg-slate-700/90 rounded border border-emerald-500/50 text-xs">
          <div className="font-semibold text-emerald-400">{hoverInfo.name}</div>
          <div className="text-slate-300">{hoverInfo.position}</div>
          {hoverInfo.snapType && (
            <div className="text-amber-400 mt-0.5">Snap: {hoverInfo.snapType}</div>
          )}
        </div>
      )}
      {/* Live preview distance (SketchUp-style) */}
      {livePreview && (
        <div className="mb-3 px-3 py-2 bg-amber-900/60 rounded border border-amber-500/70 text-sm font-mono text-amber-300">
          {livePreview}
        </div>
      )}
      {/* Status */}
      <div className="mb-4 p-2 bg-slate-600 rounded text-xs">
        <div className="mb-1">
          <strong>Status:</strong> {isActive ? 'Active' : 'Inactive'}
        </div>
        <div className="mb-1">
          <strong>Mode:</strong> {measurementMode}
        </div>
        <div className="mb-1">
          <strong>Points:</strong> {currentPoints.length}
        </div>
        {isMeasuring && (
          <div className="text-emerald-500">
            Click to add more points or "Complete" to finish
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mb-4 p-2 bg-slate-600 rounded text-xs text-slate-400">
        <div className="mb-1"><strong>Instructions:</strong></div>
        {measurementMode === 'distance' && (
          <div>Click two points to measure distance</div>
        )}
        {measurementMode === 'area' && (
          <div>Click multiple points to define area, then complete</div>
        )}
        {measurementMode === 'angle' && (
          <div>Click three points to measure angle at middle point</div>
        )}
        {(measurementMode === 'length' || measurementMode === 'breadth' || measurementMode === 'depth') && (
          <div>Click two points to measure {measurementMode}</div>
        )}
        {(measurementMode === 'circumference' || measurementMode === 'radius') && (
          <div>Click center point and edge point to measure {measurementMode}</div>
        )}
        {measurementMode === 'volume' && (
          <div>Click 8 points to define bounding box volume, then complete</div>
        )}
      </div>

      {/* Measurements List */}
      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-600 rounded">
        {measurements.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-xs">
            No measurements yet
          </div>
        ) : (
          measurements.map((measurement) => (
            <div
              key={measurement.id}
              className="p-2 border-b border-slate-600 text-xs"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-blue-500">
                  {measurement.type.toUpperCase()}
                </span>
                <button
                  onClick={() => deleteMeasurement(measurement.id)}
                  className="px-1.5 py-0.5 bg-red-500 border-0 rounded text-white text-xs cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="text-base font-bold text-emerald-400 tracking-wide" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatValue(measurement)}
              </div>

              <div className="text-slate-400 text-xs mt-0.5">
                Points: {measurement.points.length}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {measurements.length > 0 && (
        <div className="mt-3 p-2 bg-slate-600 rounded text-xs">
          <div><strong>Total Measurements:</strong> {measurements.length}</div>
          <div><strong>Distances:</strong> {measurements.filter(m => m.type === 'distance').length}</div>
          <div><strong>Areas:</strong> {measurements.filter(m => m.type === 'area').length}</div>
          <div><strong>Angles:</strong> {measurements.filter(m => m.type === 'angle').length}</div>
          <div><strong>Lengths:</strong> {measurements.filter(m => m.type === 'length').length}</div>
          <div><strong>Breadths:</strong> {measurements.filter(m => m.type === 'breadth').length}</div>
          <div><strong>Depths:</strong> {measurements.filter(m => m.type === 'depth').length}</div>
          <div><strong>Volumes:</strong> {measurements.filter(m => m.type === 'volume').length}</div>
          <div><strong>Circumferences:</strong> {measurements.filter(m => m.type === 'circumference').length}</div>
          <div><strong>Radii:</strong> {measurements.filter(m => m.type === 'radius').length}</div>
        </div>
      )}
    </div>
  );
};

export default MeasureTool;
