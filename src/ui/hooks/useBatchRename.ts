import { useState, useCallback, useRef } from 'react'
import { BatchGridState, ColumnDef, LayerInfo, SortDirection } from '../types/batch'
import { sortLayersByDirection } from '../utils/sorting'
import { parseLayerName, getMaxColumns, padParts } from '../utils/nameParser'
import { getColumnName } from '../utils/columnNames'

let columnIdCounter = 0
function generateColumnId() {
  return `col_${++columnIdCounter}`
}

interface UseBatchRenameReturn {
  state: BatchGridState

  // Grid mutations
  setCellValue: (row: number, col: number, value: string) => void
  setColumnHeader: (colIndex: number, header: string) => void
  addColumn: (afterIndex: number) => void
  deleteColumn: (colIndex: number) => void

  // Sorting
  setSortDirection: (direction: SortDirection) => void
  reorderByDirection: (layers: LayerInfo[], direction: SortDirection) => void

  // Batch fill
  fillCells: (fills: { row: number; col: number; value: string }[]) => void

  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Computed
  getPreviewNames: () => string[]
  getRenames: () => Array<{ nodeId: string; newName: string }>
  getColumnValues: (rows: number[], col: number) => string[]

  // Initialize from layers
  initializeFromLayers: (layers: LayerInfo[], direction?: SortDirection) => void
}

const MAX_HISTORY = 50

export function useBatchRename(): UseBatchRenameReturn {
  const [state, setState] = useState<BatchGridState>({
    columns: [{ id: generateColumnId(), header: getColumnName(0) }],
    rows: [],
    layerIds: [],
    layerTypes: [],
    sortDirection: 'reading-order',
  })

  const historyRef = useRef<BatchGridState[]>([])
  const futureRef = useRef<BatchGridState[]>([])

  // Helper to save state to history
  const saveToHistory = useCallback((currentState: BatchGridState) => {
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), currentState]
    futureRef.current = [] // Clear redo stack on new action
  }, [])

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return
    const previous = historyRef.current.pop()!
    setState(current => {
      futureRef.current = [current, ...futureRef.current]
      return previous
    })
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current.shift()!
    setState(current => {
      historyRef.current = [...historyRef.current, current]
      return next
    })
  }, [])

  const initializeFromLayers = useCallback((layers: LayerInfo[], direction?: SortDirection) => {
    // Sort layers by specified direction or current state
    const sortDirection = direction || state.sortDirection
    const sortedLayers = sortLayersByDirection(layers, sortDirection)

    // Parse all layer names
    const parsedNames = sortedLayers.map(layer => parseLayerName(layer.name))

    // Determine column count + 1 extra blank column for discoverability
    const columnCount = getMaxColumns(parsedNames)
    const totalColumns = columnCount + 1

    // Create columns (including blank one at end)
    const columns: ColumnDef[] = []
    for (let i = 0; i < totalColumns; i++) {
      columns.push({
        id: generateColumnId(),
        header: getColumnName(i),
      })
    }

    // Create rows with padded parts (extra empty column at end)
    const rows = parsedNames.map(parsed => [...padParts(parsed.parts, columnCount), ''])

    setState({
      columns,
      rows,
      layerIds: sortedLayers.map(l => l.id),
      layerTypes: sortedLayers.map(l => l.type),
      sortDirection: sortDirection,
    })
  }, [state.sortDirection])

  const setCellValue = useCallback((row: number, col: number, value: string) => {
    setState(prev => {
      saveToHistory(prev)
      const newRows = [...prev.rows]
      newRows[row] = [...newRows[row]]
      newRows[row][col] = value
      return { ...prev, rows: newRows }
    })
  }, [saveToHistory])

  const setColumnHeader = useCallback((colIndex: number, header: string) => {
    setState(prev => {
      saveToHistory(prev)
      const newColumns = [...prev.columns]
      newColumns[colIndex] = { ...newColumns[colIndex], header }
      return { ...prev, columns: newColumns }
    })
  }, [saveToHistory])

  const addColumn = useCallback((afterIndex: number) => {
    setState(prev => {
      saveToHistory(prev)
      const newColumns = [...prev.columns]
      newColumns.splice(afterIndex + 1, 0, {
        id: generateColumnId(),
        header: getColumnName(newColumns.length),
      })

      const newRows = prev.rows.map(row => {
        const newRow = [...row]
        newRow.splice(afterIndex + 1, 0, '')
        return newRow
      })

      return { ...prev, columns: newColumns, rows: newRows }
    })
  }, [saveToHistory])

  const deleteColumn = useCallback((colIndex: number) => {
    setState(prev => {
      if (prev.columns.length <= 1) return prev

      saveToHistory(prev)
      const newColumns = prev.columns.filter((_, i) => i !== colIndex)
      const newRows = prev.rows.map(row => row.filter((_, i) => i !== colIndex))

      return { ...prev, columns: newColumns, rows: newRows }
    })
  }, [saveToHistory])

  const setSortDirection = useCallback((direction: SortDirection) => {
    setState(prev => ({ ...prev, sortDirection: direction }))
  }, [])

  // Reorder rows by new direction while preserving edits
  const reorderByDirection = useCallback((layers: LayerInfo[], direction: SortDirection) => {
    setState(prev => {
      // Sort the layers by new direction
      const sortedLayers = sortLayersByDirection(layers, direction)

      // Create a mapping: layerId -> new index
      const newOrderMap = new Map<string, number>()
      sortedLayers.forEach((layer, newIndex) => {
        newOrderMap.set(layer.id, newIndex)
      })

      // Create arrays to hold reordered data
      const newRows: string[][] = new Array(prev.rows.length)
      const newLayerIds: string[] = new Array(prev.layerIds.length)
      const newLayerTypes: typeof prev.layerTypes = new Array(prev.layerTypes.length)

      // Reorder based on the new sort order
      prev.layerIds.forEach((layerId, oldIndex) => {
        const newIndex = newOrderMap.get(layerId)
        if (newIndex !== undefined) {
          newRows[newIndex] = prev.rows[oldIndex]
          newLayerIds[newIndex] = prev.layerIds[oldIndex]
          newLayerTypes[newIndex] = prev.layerTypes[oldIndex]
        }
      })

      return {
        ...prev,
        rows: newRows,
        layerIds: newLayerIds,
        layerTypes: newLayerTypes,
        sortDirection: direction,
      }
    })
  }, [])

  const fillCells = useCallback((fills: { row: number; col: number; value: string }[]) => {
    setState(prev => {
      saveToHistory(prev)
      const newRows = [...prev.rows]
      for (const { row, col, value } of fills) {
        if (newRows[row]) {
          newRows[row] = [...newRows[row]]
          newRows[row][col] = value
        }
      }
      return { ...prev, rows: newRows }
    })
  }, [saveToHistory])

  const getPreviewNames = useCallback((): string[] => {
    return state.rows.map(row => {
      // Empty columns become a space
      return row.map(cell => cell === '' ? ' ' : cell).join('')
    })
  }, [state.rows])

  const getRenames = useCallback((): Array<{ nodeId: string; newName: string }> => {
    return state.layerIds.map((nodeId, index) => ({
      nodeId,
      // Empty columns become a space in the final name too
      newName: state.rows[index].map(cell => cell === '' ? ' ' : cell).join(''),
    }))
  }, [state.layerIds, state.rows])

  const getColumnValues = useCallback((rows: number[], col: number): string[] => {
    return rows.map(row => state.rows[row]?.[col] ?? '')
  }, [state.rows])

  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  return {
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
    canUndo,
    canRedo,
    getPreviewNames,
    getRenames,
    getColumnValues,
    initializeFromLayers,
  }
}
