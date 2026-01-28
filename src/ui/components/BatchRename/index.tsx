import { useEffect, useCallback } from 'react'
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
  const {
    state,
    setCellValue,
    setColumnHeader,
    addColumn,
    deleteColumn,
    setSortDirection,
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
    }
  }, [layers])

  // Reorder rows when direction changes (preserves edits)
  const handleDirectionChange = useCallback((direction: SortDirection) => {
    reorderByDirection(layers, direction)
  }, [layers, reorderByDirection])

  const handleApply = useCallback(() => {
    const renames = getRenames()
    onApply(renames)
  }, [getRenames, onApply])

  const handleZoomToLayer = useCallback((nodeId: string) => {
    parent.postMessage({ pluginMessage: { type: 'zoomToLayer', nodeId } }, '*')
  }, [])

  const previewNames = getPreviewNames()

  // Request UI resize based on content
  useEffect(() => {
    const colCount = state.columns.length
    const rowCount = state.rows.length

    // Width: icon col (32) + data cols + preview col (200) + padding + buffer
    const width = Math.min(800, Math.max(380, 32 + colCount * 100 + 200 + 24 + 20))
    // Height: toolbar (36) + header (33) + rows + actions (44) + padding (32) + buffer
    const height = Math.min(500, Math.max(180, 36 + 33 + rowCount * 33 + 44 + 32))

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
        <div className="batch-count">
          {layers.length} layer{layers.length !== 1 ? 's' : ''}
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
      />

      <div className="batch-actions">
        <button className="btn-secondary" onClick={onCancel}>
          Back
        </button>
        <button className="btn-primary" onClick={handleApply}>
          Rename All
        </button>
      </div>
    </div>
  )
}
