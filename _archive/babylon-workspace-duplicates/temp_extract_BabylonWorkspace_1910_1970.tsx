// Extracted lines 1910-1970 from src/integrated/BabylonWorkspace.tsx for analysis

// Annotation Markups JSX snippet (around line 1917)
{annotations.map(a => (
  <div
    key={a.id}
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      color: a.color || '#FFD700',
      background: 'rgba(0,0,0,0.7)',
      padding: '4px 8px',
      borderRadius: '6px',
      pointerEvents: 'none',
      zIndex: 20
    }}
  >
    <span>📍</span> {a.text}
  </div>
))}

// Annotation Panel JSX snippet (around line 1964)
{showAnnotationPanel && activeAnnotation && (
  <div className="absolute left-1/2 top-1/2 bg-black/90 text-white p-4 rounded-lg shadow-lg z-30" style={{ transform: 'translate(-50%, -50%)' }}>
    <h3 className="text-sm font-bold mb-2">Add Annotation</h3>
    <textarea
      className="w-64 h-20 p-2 rounded bg-gray-800 text-white border border-gray-600"
      placeholder="Enter note..."
      value={activeAnnotation.text}
      onChange={e => setActiveAnnotation({ ...activeAnnotation, text: e.target.value })}
    />
    <div className="flex gap-2 mt-2">
      <button
        className="bg-green-600 px-4 py-1 rounded"
        onClick={() => handleSaveAnnotation(activeAnnotation.text)}
      >Save</button>
      <button
        className="bg-red-600 px-4 py-1 rounded"
        onClick={() => { setActiveAnnotation(null); setShowAnnotationPanel(false); }}
      >Cancel</button>
    </div>
  </div>
)}
