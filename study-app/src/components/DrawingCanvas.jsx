import { useRef, useState, useCallback } from 'react'
import { ReactSketchCanvas } from 'react-sketch-canvas'

const COLORS = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
]

export default function DrawingCanvas({ imageSrc, onDrawingChange }) {
  const canvasRef = useRef(null)
  const [strokeColor, setStrokeColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [eraseMode, setEraseMode] = useState(false)
  const exportTimeout = useRef(null)

  const setErase = useCallback((on) => {
    setEraseMode(on)
    canvasRef.current?.eraseMode(on)
  }, [])

  const handleUndo = () => canvasRef.current?.undo()

  const handleClear = () => {
    canvasRef.current?.clearCanvas()
    onDrawingChange(null)
  }

  // Debounced export — avoids expensive PNG generation on every stroke point
  const handleChange = useCallback(() => {
    clearTimeout(exportTimeout.current)
    exportTimeout.current = setTimeout(async () => {
      try {
        const data = await canvasRef.current?.exportImage('png')
        if (data) onDrawingChange(data)
      } catch { /* ignore */ }
    }, 600)
  }, [onDrawingChange])

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 w-full" role="toolbar" aria-label="Drawing tools">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Pen color">
          {COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => { setStrokeColor(c.value); setErase(false) }}
              aria-pressed={!eraseMode && strokeColor === c.value}
              aria-label={c.label}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                !eraseMode && strokeColor === c.value ? 'border-slate-700 scale-110' : 'border-slate-300'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" aria-hidden />

        <button
          type="button"
          onClick={() => setErase(false)}
          aria-pressed={!eraseMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            !eraseMode ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Pen
        </button>
        <button
          type="button"
          onClick={() => setErase(true)}
          aria-pressed={eraseMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            eraseMode ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Eraser
        </button>

        <div className="w-px h-5 bg-slate-200" aria-hidden />

        <button
          type="button"
          onClick={handleUndo}
          aria-label="Undo last stroke"
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ↩ Undo
        </button>
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear all drawings"
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-colors"
        >
          Clear
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <label htmlFor="stroke-width" className="text-xs text-slate-400 whitespace-nowrap">Size</label>
          <input
            id="stroke-width"
            type="range"
            min={1}
            max={10}
            value={strokeWidth}
            onChange={e => setStrokeWidth(Number(e.target.value))}
            className="w-16 accent-indigo-600"
            aria-label="Stroke width"
          />
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative w-full max-w-sm sm:max-w-md border-2 border-slate-300 rounded-xl overflow-hidden"
        style={{ aspectRatio: '1 / 1', touchAction: 'none' }}
      >
        <img
          src={imageSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
        />
        <ReactSketchCanvas
          ref={canvasRef}
          strokeWidth={strokeWidth}
          strokeColor={eraseMode ? 'rgba(255,255,255,0)' : strokeColor}
          eraserWidth={strokeWidth * 3}
          canvasColor="transparent"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          onChange={handleChange}
          withTimestamp
        />
      </div>

      <p className="text-xs text-slate-400 text-center">
        Draw with finger or mouse to mark problem areas. Drawings are saved with your response.
      </p>
    </div>
  )
}
