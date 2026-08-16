import { Scene, Mesh, VertexData, Vector3 } from '@babylonjs/core';
import type { BIMElement, BIMElementType, BIMElementProperties, BIMModel } from '../BIMManager';

// Real IFC (.ifc) parsing via web-ifc (https://github.com/ThatOpen/engine_web-ifc), a real
// open-source WASM port of the IFC engine used by BlenderBIM/IfcOpenShell - unlike Revit
// (.rvt) and AutoCAD (.dwg), which are proprietary formats with no legal local parser, IFC is
// an open standard this library can genuinely read. Geometry comes straight from the parsed
// file (real vertex/index buffers per element, world transform baked in), not a mock shape.

// IFC entity type name -> this app's constrained BIMElementType. Anything not listed falls
// back to a reasonable default per its rough IFC category rather than failing the import -
// there are hundreds of IFC entity types and most schemas only use a subset of these.
const IFC_TYPE_MAP: Record<string, BIMElementType> = {
  IFCWALL: 'wall',
  IFCWALLSTANDARDCASE: 'wall',
  IFCWALLELEMENTEDCASE: 'wall',
  IFCSLAB: 'slab',
  IFCFLOOR: 'floor',
  IFCROOF: 'roof',
  IFCCOVERING: 'ceiling',
  IFCDOOR: 'door',
  IFCWINDOW: 'window',
  IFCBEAM: 'beam',
  IFCCOLUMN: 'column',
  IFCDUCTSEGMENT: 'duct',
  IFCPIPESEGMENT: 'pipe',
  IFCCABLECARRIERSEGMENT: 'cable',
  IFCFURNISHINGELEMENT: 'fixture',
  IFCFLOWTERMINAL: 'fixture',
  IFCSANITARYTERMINAL: 'fixture',
  IFCLIGHTFIXTURE: 'fixture',
  IFCSTAIR: 'column', // no dedicated stair type in this app's BIMElementType - closest sturdy fallback
  IFCRAILING: 'beam',
};

function mapIfcTypeName(typeName: string): BIMElementType {
  return IFC_TYPE_MAP[typeName.toUpperCase()] ?? 'fixture';
}

// web-ifc's flatTransformation is a flat column-major 4x4 matrix (16 numbers) already in
// world space for this placed geometry piece - applying it directly to each vertex here (once,
// at parse time) means the resulting BIMElement can use identity position/rotation/scale,
// consistent with how the rest of BIMManager treats an element's mesh as already "placed".
function transformPositions(positions: Float32Array, matrix: number[]): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    out[i] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    out[i + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    out[i + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  }
  return out;
}

function transformNormals(normals: Float32Array, matrix: number[]): Float32Array {
  // Normals only rotate/scale, never translate - drop the matrix's translation row (indices
  // 12/13/14) by using the same 3x3 rotation/scale block as transformPositions without it.
  const out = new Float32Array(normals.length);
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i], y = normals[i + 1], z = normals[i + 2];
    out[i] = matrix[0] * x + matrix[4] * y + matrix[8] * z;
    out[i + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z;
    out[i + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z;
  }
  return out;
}

// IFC's own convention is right-handed Z-up, which would normally need converting for
// Babylon's left-handed Y-up (a Y/Z swap, which conveniently fixes handedness and winding at
// the same time as the up-axis). But that's not needed here: verified empirically (loaded a
// hand-built test .ifc - a single extruded rectangular wall - through this exact function
// into a real Babylon scene and inspected the rendered result) that web-ifc's own vertex
// output is already Y-up and comes out correctly oriented/shaded with no adjustment. Kept as
// a passthrough (not deleted outright) so the reasoning stays attached to the empirical
// finding if a future IFC file ever renders sideways and someone has to debug why.
function ifcToBabylonSpace(v: Float32Array): Float32Array {
  return v;
}

export async function parseIFCToBIMModel(file: File, modelId: string, scene: Scene): Promise<BIMModel> {
  const { IfcAPI } = await import('web-ifc');
  const ifcApi = new IfcAPI();
  // web-ifc-mt.wasm (multi-threaded) needs cross-origin isolation (COOP/COEP headers) this
  // app doesn't set up - the single-threaded web-ifc.wasm works everywhere without that, at
  // the cost of parsing on the main thread rather than a worker.
  ifcApi.SetWasmPath('/wasm/', true);
  await ifcApi.Init();

  const buffer = new Uint8Array(await file.arrayBuffer());
  const modelHandle = ifcApi.OpenModel(buffer, { COORDINATE_TO_ORIGIN: true });
  if (modelHandle < 0) {
    ifcApi.Dispose();
    throw new Error('web-ifc could not open this file - it may not be a valid IFC file');
  }

  const elements: BIMElement[] = [];

  try {
    const flatMeshes = ifcApi.LoadAllGeometry(modelHandle);
    for (let i = 0; i < flatMeshes.size(); i++) {
      const flatMesh = flatMeshes.get(i);
      const expressID = flatMesh.expressID;
      const geometryCount = flatMesh.geometries.size();
      if (geometryCount === 0) continue;

      // Merge every placed-geometry piece belonging to this element into one Babylon mesh -
      // an IFC element (e.g. a wall with a door opening already cut into it) is frequently
      // represented as more than one geometry piece.
      const mergedPositions: number[] = [];
      const mergedNormals: number[] = [];
      const mergedIndices: number[] = [];
      let indexOffset = 0;

      for (let g = 0; g < geometryCount; g++) {
        const placedGeometry = flatMesh.geometries.get(g);
        const geometry = ifcApi.GetGeometry(modelHandle, placedGeometry.geometryExpressID);
        const vertexData = ifcApi.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
        const indexData = ifcApi.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
        geometry.delete();

        // web-ifc interleaves position (xyz) + normal (xyz) per vertex, 6 floats each.
        const vertexCount = vertexData.length / 6;
        const rawPositions = new Float32Array(vertexCount * 3);
        const rawNormals = new Float32Array(vertexCount * 3);
        for (let v = 0; v < vertexCount; v++) {
          rawPositions[v * 3] = vertexData[v * 6];
          rawPositions[v * 3 + 1] = vertexData[v * 6 + 1];
          rawPositions[v * 3 + 2] = vertexData[v * 6 + 2];
          rawNormals[v * 3] = vertexData[v * 6 + 3];
          rawNormals[v * 3 + 1] = vertexData[v * 6 + 4];
          rawNormals[v * 3 + 2] = vertexData[v * 6 + 5];
        }

        const worldPositions = ifcToBabylonSpace(transformPositions(rawPositions, placedGeometry.flatTransformation));
        const worldNormals = ifcToBabylonSpace(transformNormals(rawNormals, placedGeometry.flatTransformation));

        mergedPositions.push(...worldPositions);
        mergedNormals.push(...worldNormals);
        for (let idx = 0; idx < indexData.length; idx++) {
          mergedIndices.push(indexData[idx] + indexOffset);
        }
        indexOffset += vertexCount;
      }

      if (mergedIndices.length === 0) continue;

      const mesh = new Mesh(`ifc_${expressID}`, scene);
      const vertexData = new VertexData();
      vertexData.positions = mergedPositions;
      vertexData.normals = mergedNormals;
      vertexData.indices = mergedIndices;
      vertexData.applyToMesh(mesh, true);

      let name = `IFC Element ${expressID}`;
      let typeName = 'IFCBUILDINGELEMENTPROXY';
      try {
        const props = await ifcApi.properties.getItemProperties(modelHandle, expressID);
        if (props?.Name?.value) name = String(props.Name.value);
        const lineType = ifcApi.GetLineType(modelHandle, expressID);
        if (typeof lineType === 'number') {
          typeName = ifcApi.GetNameFromTypeCode(lineType) || typeName;
        }
      } catch {
        // Some elements (e.g. IfcOpeningElement-derived geometry) don't resolve properties
        // cleanly - fall back to the generic name/type above rather than failing the whole
        // import over one element.
      }

      const elementProperties: BIMElementProperties = {};
      const bimElement: BIMElement = {
        id: `ifc_element_${expressID}`,
        name,
        type: mapIfcTypeName(typeName),
        category: 'Architecture',
        position: Vector3.Zero(),
        rotation: Vector3.Zero(),
        scale: Vector3.One(),
        properties: elementProperties,
        mesh,
        visible: true,
      };
      elements.push(bimElement);
    }
  } finally {
    ifcApi.CloseModel(modelHandle);
    ifcApi.Dispose();
  }

  return {
    id: modelId,
    name: file.name.replace(/\.ifc$/i, ''),
    source: 'ifc',
    elements,
    hiddenDetails: [],
    metadata: {
      author: 'IFC Import',
      created: new Date(),
      lastModified: new Date(),
      units: 'meters',
      coordinateSystem: 'IFC local',
    },
  };
}
