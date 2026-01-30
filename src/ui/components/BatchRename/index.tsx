import { useEffect, useCallback, useState } from 'react'
import { LayerInfo, SortDirection } from '../../types/batch'
import { DirectionPicker } from './DirectionPicker'
import { BatchGrid } from './BatchGrid'
import { useBatchRename } from '../../hooks/useBatchRename'

interface BatchRenameProps {
  layers: LayerInfo[]
  onApply: (renames: Array<{ nodeId: string; newName: string }>) => void
  onCancel: () => void
}

export function BatchRename({ layers, onApply, onCancel }: BatchRenameProps) {
  const [autoZoom, setAutoZoom] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const {
    state,
    setCellValue,
    setColumnHeader,
    addColumn,
    deleteColumn,
    reorderByDirection,
    fillCells,
    undo,
    redo,
    getPreviewNames,
    getRenames,
    getColumnValues,
    initializeFromLayers,
  } = useBatchRename()

  // Initialize when layers change
  useEffect(() => {
    if (layers.length > 0) {
      initializeFromLayers(layers, 'reading-order')
      // Highlight the first layer when entering Advanced mode
      parent.postMessage({ pluginMessage: { type: 'highlightLayer', nodeId: layers[0].id } }, '*')
    }
  }, [layers])

  // Cleanup highlight when component unmounts (leaving Advanced mode)
  useEffect(() => {
    return () => {
      parent.postMessage({ pluginMessage: { type: 'removeHighlight' } }, '*')
    }
  }, [])

  // Reorder rows when direction changes (preserves edits)
  const handleDirectionChange = useCallback((direction: SortDirection) => {
    reorderByDirection(layers, direction)
  }, [layers, reorderByDirection])

  const handleApply = useCallback(() => {
    const renames = getRenames()
    onApply(renames)
    // Remove highlight after applying
    parent.postMessage({ pluginMessage: { type: 'removeHighlight' } }, '*')
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 1500)
  }, [getRenames, onApply])

  // Keyboard shortcut: Cmd/Ctrl + Enter to apply
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleApply()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleApply])

  const handleZoomToLayer = useCallback((nodeId: string) => {
    parent.postMessage({ pluginMessage: { type: 'zoomToLayer', nodeId } }, '*')
  }, [])

  const handleRowSelect = useCallback((rowIndex: number) => {
    const nodeId = state.layerIds[rowIndex]
    if (nodeId) {
      // Always highlight the focused layer in Advanced mode
      parent.postMessage({ pluginMessage: { type: 'highlightLayer', nodeId } }, '*')

      // Only zoom if Track mode is enabled
      if (autoZoom) {
        parent.postMessage({ pluginMessage: { type: 'zoomToLayer', nodeId } }, '*')
      }
    }
  }, [autoZoom, state.layerIds])

  const previewNames = getPreviewNames()

  // Request UI resize based on content
  useEffect(() => {
    const colCount = state.columns.length
    const rowCount = state.rows.length

    // Width calculation - consistent for all, with horizontal scroll when needed
    const calculatedWidth = 32 + colCount * 70 + 100 + 24 + 20
    const width = Math.min(450, Math.max(400, calculatedWidth))
    // Height breakdown:
    // - Container padding: 24px (12 top + 12 bottom)
    // - Toolbar: 40px
    // - Gap after toolbar: 8px
    // - Grid border: 2px (1 top + 1 bottom)
    // - Grid header: 40px
    // - Grid rows: rowCount * 40px (preview-cell line-height 32px + padding 8px)
    // - Grid row gaps: (rowCount - 1) * 1px if rowCount > 1
    // - Gap after grid: 8px
    // - Actions: 32px
    const rowGaps = rowCount > 1 ? (rowCount - 1) : 0
    const calculatedHeight = 24 + 40 + 8 + 2 + 40 + (rowCount * 40) + rowGaps + 8 + 32
    const height = Math.min(500, Math.max(200, calculatedHeight))

    parent.postMessage(
      { pluginMessage: { type: 'resizeUI', width, height } },
      '*'
    )
  }, [state.columns.length, state.rows.length])

  if (layers.length === 0) {
    return (
      <div className="batch-empty">
        Select layers to batch rename
      </div>
    )
  }

  return (
    <div className="batch-rename">
      <div className="batch-toolbar">
        <DirectionPicker
          direction={state.sortDirection}
          onChange={handleDirectionChange}
        />
        <div className="batch-toolbar-right">
          <label className="track-toggle" onMouseDown={(e) => e.preventDefault()}>
            <span>Track</span>
            <div className={`toggle-switch ${autoZoom ? 'active' : ''}`} onClick={() => setAutoZoom(!autoZoom)}>
              <div className="toggle-knob" />
            </div>
          </label>
          <div className="batch-count">
            {layers.length} layer{layers.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <BatchGrid
        state={state}
        onCellChange={setCellValue}
        onColumnHeaderChange={setColumnHeader}
        onAddColumn={addColumn}
        onDeleteColumn={deleteColumn}
        onFillCells={fillCells}
        onUndo={undo}
        onRedo={redo}
        getColumnValues={getColumnValues}
        previewNames={previewNames}
        onZoomToLayer={handleZoomToLayer}
        onRowSelect={handleRowSelect}
      />

      <div className="batch-actions">
        <button className="btn-secondary" onClick={onCancel}>
          Back
        </button>
        <button className={`btn-primary ${showSuccess ? 'btn-success' : ''}`} onClick={handleApply}>
          {showSuccess ? 'Applied ✓' : <><span>Apply</span><span className="shortcut-key"><span>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span><span>↵</span></span></>}
        </button>
      </div>
    </div>
  )
}
