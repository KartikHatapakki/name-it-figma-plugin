import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus } from '@phosphor-icons/react'
import { BatchGridState } from '../../types/batch'
import { LayerIcon } from '../shared/LayerIcon'
import { GridCell } from './GridCell'
import { ColumnHeader } from './ColumnHeader'
import { AddColumnButton } from './AddColumnButton'
import { detectSeries, continueSeries } from '../../utils/seriesGenerator'

interface BatchGridProps {
  state: BatchGridState
  onCellChange: (row: number, col: number, value: string) => void
  onColumnHeaderChange: (colIndex: number, header: string) => void
  onAddColumn: (afterIndex: number) => void
  onDeleteColumn: (colIndex: number) => void
  onFillCells: (fills: { row: number; col: number; value: string }[]) => void
  onUndo: () => void
  onRedo: () => void
  getColumnValues: (rows: number[], col: number) => string[]
  previewNames: string[]
  onZoomToLayer: (nodeId: string) => void
}

interface Selection {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export function BatchGrid({
  state,
  onCellChange,
  onColumnHeaderChange,
  onAddColumn,
  onDeleteColumn,
  onFillCells,
  onUndo,
  onRedo,
  getColumnValues,
  previewNames,
  onZoomToLayer,
}: BatchGridProps) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [isDraggingFill, setIsDraggingFill] = useState(false)
  const [dragTargetRow, setDragTargetRow] = useState<number | null>(null)
  const [dragTargetCol, setDragTargetCol] = useState<number | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number; mode: 'typing' | 'doubleclick' } | null>(null)
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(null)
  const [clipboard, setClipboard] = useState<string[][] | null>(null)
  const [isCut, setIsCut] = useState(false)

  // Refs to track current values for event handlers
  const selectionRef = useRef<Selection | null>(null)
  const editingCellRef = useRef<{ row: number; col: number; mode: 'typing' | 'doubleclick' } | null>(null)
  const dragTargetRowRef = useRef<number | null>(null)
  const dragTargetColRef = useRef<number | null>(null)
  const isDraggingFillRef = useRef(false)
  const isSelectingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollIntervalYRef = useRef<number | null>(null)
  const scrollIntervalXRef = useRef<number | null>(null)

  // Keep refs in sync with state
  useEffect(() => {
    selectionRef.current = selection
    dragTargetRowRef.current = dragTargetRow
    dragTargetColRef.current = dragTargetCol
    isDraggingFillRef.current = isDraggingFill
    isSelectingRef.current = isSelecting
  }, [selection, dragTargetRow, dragTargetCol, isDraggingFill, isSelecting])

  // Auto-select first cell and focus container when grid loads
  useEffect(() => {
    if (state.rows.length > 0 && state.columns.length > 0 && !selection) {
      setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })
    }
    if (containerRef.current) {
      containerRef.current.focus()
    }
  }, [state.rows.length, state.columns.length])

  // Get normalized selection (start always <= end)
  const getNormalizedSelection = useCallback((sel: Selection | null) => {
    if (!sel) return null
    return {
      startRow: Math.min(sel.startRow, sel.endRow),
      endRow: Math.max(sel.startRow, sel.endRow),
      startCol: Math.min(sel.startCol, sel.endCol),
      endCol: Math.max(sel.startCol, sel.endCol),
    }
  }, [])

  // Check if cell is in selection range
  const isCellInSelection = useCallback((row: number, col: number) => {
    const sel = getNormalizedSelection(selection)
    if (!sel) return false
    return row >= sel.startRow && row <= sel.endRow && col >= sel.startCol && col <= sel.endCol
  }, [selection, getNormalizedSelection])

  // Check if cell is in drag fill range
  const isCellInDragRange = useCallback((row: number, col: number) => {
    if (!isDraggingFill || !selection) return false
    const sel = getNormalizedSelection(selection)
    if (!sel) return false

    // Determine drag direction based on target position
    const isVerticalDrag = dragTargetRow !== null && (dragTargetRow < sel.startRow || dragTargetRow > sel.endRow)
    const isHorizontalDrag = dragTargetCol !== null && (dragTargetCol < sel.startCol || dragTargetCol > sel.endCol)

    // Vertical drag fill
    if (isVerticalDrag && !isHorizontalDrag) {
      if (col < sel.startCol || col > sel.endCol) return false
      if (dragTargetRow! > sel.endRow) {
        return row > sel.endRow && row <= dragTargetRow!
      } else if (dragTargetRow! < sel.startRow) {
        return row < sel.startRow && row >= dragTargetRow!
      }
    }

    // Horizontal drag fill
    if (isHorizontalDrag && !isVerticalDrag) {
      if (row < sel.startRow || row > sel.endRow) return false
      if (dragTargetCol! > sel.endCol) {
        return col > sel.endCol && col <= dragTargetCol!
      } else if (dragTargetCol! < sel.startCol) {
        return col < sel.startCol && col >= dragTargetCol!
      }
    }

    return false
  }, [isDraggingFill, dragTargetRow, dragTargetCol, selection, getNormalizedSelection])

  // Clear selected cells
  const clearSelectedCells = useCallback(() => {
    const sel = getNormalizedSelection(selection)
    if (!sel) return

    const fills: { row: number; col: number; value: string }[] = []
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        fills.push({ row: r, col: c, value: '' })
      }
    }
    if (fills.length > 0) {
      onFillCells(fills)
    }
  }, [selection, getNormalizedSelection, onFillCells])

  // Copy selected cells to clipboard
  const copySelectedCells = useCallback(() => {
    const sel = getNormalizedSelection(selection)
    if (!sel) return

    const data: string[][] = []
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      const row: string[] = []
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        row.push(state.rows[r]?.[c] ?? '')
      }
      data.push(row)
    }
    setClipboard(data)

    // Also copy to system clipboard
    const text = data.map(row => row.join('\t')).join('\n')
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: ignore if clipboard API not available
    })
  }, [selection, getNormalizedSelection, state.rows])

  // Cut selected cells
  const cutSelectedCells = useCallback(() => {
    copySelectedCells()
    setIsCut(true)
  }, [copySelectedCells])

  // Paste from internal or system clipboard
  const pasteFromClipboard = useCallback((pasteData?: string) => {
    const sel = getNormalizedSelection(selection)
    if (!sel) return

    const startRow = sel.startRow
    const startCol = sel.startCol

    const processPaste = (data: string[][]) => {
      const fills: { row: number; col: number; value: string }[] = []

      data.forEach((rowData, rowOffset) => {
        rowData.forEach((cellValue, colOffset) => {
          const targetRow = startRow + rowOffset
          const targetCol = startCol + colOffset
          if (targetRow < state.rows.length && targetCol < state.columns.length) {
            fills.push({ row: targetRow, col: targetCol, value: cellValue })
          }
        })
      })

      if (fills.length > 0) {
        onFillCells(fills)
      }

      // If this was a cut operation, clear the source cells
      if (isCut && clipboard) {
        const cutSel = getNormalizedSelection(selectionRef.current)
        if (cutSel) {
          const clearFills: { row: number; col: number; value: string }[] = []
          for (let r = 0; r < clipboard.length; r++) {
            for (let c = 0; c < clipboard[r].length; c++) {
              const srcRow = cutSel.startRow + r
              const srcCol = cutSel.startCol + c
              // Don't clear if pasting over the same cells
              if (srcRow < startRow || srcRow >= startRow + clipboard.length ||
                  srcCol < startCol || srcCol >= startCol + clipboard[0].length) {
                clearFills.push({ row: srcRow, col: srcCol, value: '' })
              }
            }
          }
          if (clearFills.length > 0) {
            onFillCells(clearFills)
          }
        }
        setIsCut(false)
      }
    }

    if (pasteData) {
      // From system clipboard
      const lines = pasteData.split(/\r?\n/).filter(line => line.length > 0)
      const data = lines.map(line => line.split('\t'))
      processPaste(data)
    } else if (clipboard) {
      // From internal clipboard
      processPaste(clipboard)
    }
  }, [selection, getNormalizedSelection, state.rows.length, state.columns.length, onFillCells, clipboard, isCut])

  // Handle cell mouse down
  const handleCellMouseDown = useCallback((e: React.MouseEvent, row: number, col: number) => {
    // Check if clicking inside already selected single cell
    const sel = getNormalizedSelection(selection)
    const isClickingInsideSelectedCell = sel &&
      sel.startRow === row && sel.endRow === row &&
      sel.startCol === col && sel.endCol === col

    // If clicking inside already selected cell, enter edit mode and let cursor position
    if (isClickingInsideSelectedCell) {
      // Enter edit mode - cursor will be positioned by native behavior
      editingCellRef.current = { row, col, mode: 'doubleclick' }
      setEditingCell({ row, col, mode: 'doubleclick' })
      return
    }

    e.preventDefault()

    // Exit editing mode
    editingCellRef.current = null
    setEditingCell(null)

    if (e.shiftKey && selection) {
      // Extend selection
      setSelection(prev => prev ? { ...prev, endRow: row, endCol: col } : null)
    } else {
      // Start new selection
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col })
      setIsSelecting(true)
    }
  }, [selection, getNormalizedSelection])

  // Handle double click to enter edit mode
  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    editingCellRef.current = { row, col, mode: 'doubleclick' }
    setEditingCell({ row, col, mode: 'doubleclick' })
    setSelection({ startRow: row, startCol: col, endRow: row, endCol: col })
  }, [])

  // Handle cell mouse enter during selection or drag
  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (isSelecting) {
      setSelection(prev => prev ? { ...prev, endRow: row, endCol: col } : null)
    }
    if (isDraggingFill) {
      setDragTargetRow(row)
    }
  }, [isSelecting, isDraggingFill])

  // Auto-scroll during drag or selection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return

    const isDragging = isDraggingFillRef.current
    const isSelectingNow = isSelectingRef.current

    if (!isDragging && !isSelectingNow) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const edgeThreshold = 40
    const minSpeed = 4
    const maxSpeed = 30

    // Calculate speed based on distance from edge (further = faster)
    const getScrollSpeed = (distance: number) => {
      const ratio = Math.min(1, Math.max(0, distance / 100))
      return minSpeed + (maxSpeed - minSpeed) * ratio
    }

    // Clear any existing vertical scroll interval
    if (scrollIntervalYRef.current) {
      clearInterval(scrollIntervalYRef.current)
      scrollIntervalYRef.current = null
    }

    // Clear any existing horizontal scroll interval
    if (scrollIntervalXRef.current) {
      clearInterval(scrollIntervalXRef.current)
      scrollIntervalXRef.current = null
    }

    // Vertical auto-scroll with velocity based on distance
    if (e.clientY > rect.bottom - edgeThreshold) {
      const distance = e.clientY - (rect.bottom - edgeThreshold)
      const speed = getScrollSpeed(distance)
      scrollIntervalYRef.current = window.setInterval(() => {
        container.scrollTop += speed
      }, 16)
    } else if (e.clientY < rect.top + edgeThreshold) {
      const distance = (rect.top + edgeThreshold) - e.clientY
      const speed = getScrollSpeed(distance)
      scrollIntervalYRef.current = window.setInterval(() => {
        container.scrollTop -= speed
      }, 16)
    }

    // Horizontal auto-scroll with velocity based on distance
    if (e.clientX > rect.right - edgeThreshold) {
      const distance = e.clientX - (rect.right - edgeThreshold)
      const speed = getScrollSpeed(distance)
      scrollIntervalXRef.current = window.setInterval(() => {
        container.scrollLeft += speed
      }, 16)
    } else if (e.clientX < rect.left + edgeThreshold) {
      const distance = (rect.left + edgeThreshold) - e.clientX
      const speed = getScrollSpeed(distance)
      scrollIntervalXRef.current = window.setInterval(() => {
        container.scrollLeft -= speed
      }, 16)
    }

    // Find the row and column under the mouse cursor
    const gridBody = container.querySelector('.batch-grid-body')
    if (gridBody) {
      const rows = gridBody.querySelectorAll('.batch-grid-row')
      for (let i = 0; i < rows.length; i++) {
        const rowRect = rows[i].getBoundingClientRect()
        if (e.clientY >= rowRect.top && e.clientY <= rowRect.bottom) {
          const cells = rows[i].querySelectorAll('.batch-grid-cell')
          for (let j = 0; j < cells.length; j++) {
            const cellRect = cells[j].getBoundingClientRect()
            if (e.clientX >= cellRect.left && e.clientX <= cellRect.right) {
              if (isDragging) {
                setDragTargetRow(i)
                setDragTargetCol(j)
              }
              if (isSelectingNow) {
                setSelection(prev => prev ? { ...prev, endRow: i, endCol: j } : null)
              }
              break
            }
          }
          break
        }
      }
    }
  }, [])

  // Get values from a row across specified columns
  const getRowValues = useCallback((row: number, cols: number[]): string[] => {
    return cols.map(col => state.rows[row]?.[col] ?? '')
  }, [state.rows])

  // Apply drag fill using refs for current values
  const applyDragFill = useCallback(() => {
    const sel = getNormalizedSelection(selectionRef.current)
    const targetRow = dragTargetRowRef.current
    const targetCol = dragTargetColRef.current

    if (!sel) return

    const fills: { row: number; col: number; value: string }[] = []

    // Determine drag direction
    const isVerticalDrag = targetRow !== null && (targetRow < sel.startRow || targetRow > sel.endRow)
    const isHorizontalDrag = targetCol !== null && (targetCol < sel.startCol || targetCol > sel.endCol)

    // Vertical drag fill (fill rows)
    if (isVerticalDrag && !isHorizontalDrag && targetRow !== null) {
      for (let col = sel.startCol; col <= sel.endCol; col++) {
        const sourceRows: number[] = []
        for (let r = sel.startRow; r <= sel.endRow; r++) {
          sourceRows.push(r)
        }
        const sourceValues = getColumnValues(sourceRows, col)
        const series = detectSeries(sourceValues)

        let targetRows: number[] = []
        if (targetRow > sel.endRow) {
          for (let r = sel.endRow + 1; r <= targetRow; r++) {
            targetRows.push(r)
          }
        } else if (targetRow < sel.startRow) {
          for (let r = sel.startRow - 1; r >= targetRow; r--) {
            targetRows.push(r)
          }
        }

        const newValues = continueSeries(series, targetRows.length)
        targetRows.forEach((row, idx) => {
          fills.push({ row, col, value: newValues[idx] })
        })
      }

      if (fills.length > 0) {
        onFillCells(fills)
        const normSel = getNormalizedSelection(selectionRef.current)
        if (normSel) {
          if (targetRow > normSel.endRow) {
            setSelection({ ...normSel, endRow: targetRow })
          } else if (targetRow < normSel.startRow) {
            setSelection({ ...normSel, startRow: targetRow })
          }
        }
      }
    }

    // Horizontal drag fill (fill columns)
    if (isHorizontalDrag && !isVerticalDrag && targetCol !== null) {
      for (let row = sel.startRow; row <= sel.endRow; row++) {
        const sourceCols: number[] = []
        for (let c = sel.startCol; c <= sel.endCol; c++) {
          sourceCols.push(c)
        }
        const sourceValues = getRowValues(row, sourceCols)
        const series = detectSeries(sourceValues)

        let targetCols: number[] = []
        if (targetCol > sel.endCol) {
          for (let c = sel.endCol + 1; c <= targetCol; c++) {
            targetCols.push(c)
          }
        } else if (targetCol < sel.startCol) {
          for (let c = sel.startCol - 1; c >= targetCol; c--) {
            targetCols.push(c)
          }
        }

        const newValues = continueSeries(series, targetCols.length)
        targetCols.forEach((col, idx) => {
          fills.push({ row, col, value: newValues[idx] })
        })
      }

      if (fills.length > 0) {
        onFillCells(fills)
        const normSel = getNormalizedSelection(selectionRef.current)
        if (normSel) {
          if (targetCol > normSel.endCol) {
            setSelection({ ...normSel, endCol: targetCol })
          } else if (targetCol < normSel.startCol) {
            setSelection({ ...normSel, startCol: targetCol })
          }
        }
      }
    }
  }, [getNormalizedSelection, getColumnValues, getRowValues, onFillCells])

  // Handle mouse up to end selection/drag
  useEffect(() => {
    const handleMouseUp = () => {
      if (scrollIntervalYRef.current) {
        clearInterval(scrollIntervalYRef.current)
        scrollIntervalYRef.current = null
      }
      if (scrollIntervalXRef.current) {
        clearInterval(scrollIntervalXRef.current)
        scrollIntervalXRef.current = null
      }

      setIsSelecting(false)

      if (isDraggingFillRef.current) {
        applyDragFill()
        setIsDraggingFill(false)
        setDragTargetRow(null)
        setDragTargetCol(null)
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousemove', handleMouseMove)
      if (scrollIntervalYRef.current) {
        clearInterval(scrollIntervalYRef.current)
      }
      if (scrollIntervalXRef.current) {
        clearInterval(scrollIntervalXRef.current)
      }
    }
  }, [applyDragFill, handleMouseMove])

  // Handle drag handle mouse down
  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFill(true)
    if (selection) {
      const sel = getNormalizedSelection(selection)
      if (sel) {
        setDragTargetRow(sel.endRow)
        setDragTargetCol(sel.endCol)
      }
    }
  }, [selection, getNormalizedSelection])

  // Handle container paste
  const handleContainerPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasteData = e.clipboardData.getData('text')
    if (!pasteData) return

    // If no selection, select first cell first
    if (!selection) {
      setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })
    }

    // Parse and paste data
    const lines = pasteData.split(/\r?\n/).filter(line => line.length > 0)
    const data = lines.map(line => line.split('\t'))

    const sel = selection ? getNormalizedSelection(selection) : { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }
    if (!sel) return

    const fills: { row: number; col: number; value: string }[] = []

    data.forEach((rowData, rowOffset) => {
      rowData.forEach((cellValue, colOffset) => {
        const targetRow = sel.startRow + rowOffset
        const targetCol = sel.startCol + colOffset
        if (targetRow < state.rows.length && targetCol < state.columns.length) {
          fills.push({ row: targetRow, col: targetCol, value: cellValue.trim() })
        }
      })
    })

    if (fills.length > 0) {
      onFillCells(fills)
    }
  }, [selection, getNormalizedSelection, state.rows.length, state.columns.length, onFillCells])

  // Handle container keydown for global shortcuts
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    const sel = getNormalizedSelection(selection)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdKey = isMac ? e.metaKey : e.ctrlKey

    // Select all - works even without selection, but not when editing
    if (cmdKey && e.key === 'a') {
      if (!editingCell) {
        e.preventDefault()
        e.stopPropagation()
        setSelection({
          startRow: 0,
          startCol: 0,
          endRow: state.rows.length - 1,
          endCol: state.columns.length - 1,
        })
      }
      return
    }

    // Undo - Cmd+Z
    if (cmdKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      onUndo()
      return
    }

    // Redo - Cmd+Shift+Z or Cmd+Y
    if ((cmdKey && e.key === 'z' && e.shiftKey) || (cmdKey && e.key === 'y')) {
      e.preventDefault()
      e.stopPropagation()
      onRedo()
      return
    }

    // Escape - deselect or exit edit mode
    if (e.key === 'Escape') {
      e.preventDefault()
      if (editingCell) {
        editingCellRef.current = null
        setEditingCell(null)
      } else {
        setSelection(null)
      }
      return
    }

    // No selection - ignore most keys
    if (!sel) return

    // Copy
    if (cmdKey && e.key === 'c') {
      e.preventDefault()
      copySelectedCells()
      return
    }

    // Cut
    if (cmdKey && e.key === 'x') {
      e.preventDefault()
      cutSelectedCells()
      return
    }

    // Paste
    if (cmdKey && e.key === 'v') {
      // Let the paste event handle this
      return
    }

    // Delete/Backspace - clear selected cells
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!editingCell) {
        e.preventDefault()
        clearSelectedCells()
        return
      }
    }

    // Arrow key navigation when not editing
    if (!editingCell) {
      const row = sel.startRow
      const col = sel.startCol

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (e.shiftKey) {
          setSelection(prev => prev ? {
            ...prev,
            endRow: Math.min(prev.endRow + 1, state.rows.length - 1)
          } : null)
        } else if (row < state.rows.length - 1) {
          setSelection({ startRow: row + 1, startCol: col, endRow: row + 1, endCol: col })
        }
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (e.shiftKey) {
          setSelection(prev => prev ? {
            ...prev,
            endRow: Math.max(prev.endRow - 1, 0)
          } : null)
        } else if (row > 0) {
          setSelection({ startRow: row - 1, startCol: col, endRow: row - 1, endCol: col })
        }
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.shiftKey) {
          setSelection(prev => prev ? {
            ...prev,
            endCol: Math.min(prev.endCol + 1, state.columns.length - 1)
          } : null)
        } else if (col < state.columns.length - 1) {
          setSelection({ startRow: row, startCol: col + 1, endRow: row, endCol: col + 1 })
        }
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.shiftKey) {
          setSelection(prev => prev ? {
            ...prev,
            endCol: Math.max(prev.endCol - 1, 0)
          } : null)
        } else if (col > 0) {
          setSelection({ startRow: row, startCol: col - 1, endRow: row, endCol: col - 1 })
        }
        return
      }

      // Tab navigation
      if (e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          if (col > 0) {
            setSelection({ startRow: row, startCol: col - 1, endRow: row, endCol: col - 1 })
          } else if (row > 0) {
            setSelection({ startRow: row - 1, startCol: state.columns.length - 1, endRow: row - 1, endCol: state.columns.length - 1 })
          }
        } else {
          if (col < state.columns.length - 1) {
            setSelection({ startRow: row, startCol: col + 1, endRow: row, endCol: col + 1 })
          } else if (row < state.rows.length - 1) {
            setSelection({ startRow: row + 1, startCol: 0, endRow: row + 1, endCol: 0 })
          }
        }
        return
      }

      // Enter - move down or enter edit mode
      if (e.key === 'Enter') {
        e.preventDefault()
        if (row < state.rows.length - 1) {
          setSelection({ startRow: row + 1, startCol: col, endRow: row + 1, endCol: col })
        }
        return
      }

      // F2 - enter edit mode
      if (e.key === 'F2') {
        e.preventDefault()
        editingCellRef.current = { row, col, mode: 'doubleclick' }
        setEditingCell({ row, col, mode: 'doubleclick' })
        return
      }
    }

    // Typing a printable character - enter edit mode and start typing
    // Use ref for synchronous check to avoid race condition with rapid typing
    if (!editingCellRef.current && !cmdKey && e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      // Single character key pressed - enter edit mode
      e.preventDefault()
      const row = sel.startRow
      const col = sel.startCol
      // Clear cell and set to typed character
      onCellChange(row, col, e.key)
      // Update ref synchronously before state to prevent race condition
      editingCellRef.current = { row, col, mode: 'typing' }
      setEditingCell({ row, col, mode: 'typing' })
      // Select just this cell
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col })
    }
    // Already in typing mode but input might not be focused yet - append character
    else if (editingCellRef.current?.mode === 'typing' && !cmdKey && e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      // Check if the focused element is our input - if not, we need to handle the keystroke
      const activeEl = document.activeElement as HTMLInputElement
      const isInputFocused = activeEl?.tagName === 'INPUT' && activeEl.closest('.batch-grid-cell')
      if (!isInputFocused) {
        e.preventDefault()
        const { row, col } = editingCellRef.current
        const currentValue = state.rows[row]?.[col] ?? ''
        onCellChange(row, col, currentValue + e.key)
      }
    }
  }, [selection, editingCell, getNormalizedSelection, copySelectedCells, cutSelectedCells, clearSelectedCells, state.rows, state.columns.length, onCellChange, onUndo, onRedo])

  // Handle cell keydown for navigation
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, row: number, col: number) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdKey = isMac ? e.metaKey : e.ctrlKey

    // Let container handle these
    if (cmdKey || e.key === 'Escape') return

    // Tab navigation
    if (e.key === 'Tab') {
      e.preventDefault()
      editingCellRef.current = null
      setEditingCell(null)
      if (e.shiftKey) {
        // Move left, wrap to previous row
        if (col > 0) {
          setSelection({ startRow: row, startCol: col - 1, endRow: row, endCol: col - 1 })
        } else if (row > 0) {
          setSelection({ startRow: row - 1, startCol: state.columns.length - 1, endRow: row - 1, endCol: state.columns.length - 1 })
        }
      } else {
        // Move right, wrap to next row
        if (col < state.columns.length - 1) {
          setSelection({ startRow: row, startCol: col + 1, endRow: row, endCol: col + 1 })
        } else if (row < state.rows.length - 1) {
          setSelection({ startRow: row + 1, startCol: 0, endRow: row + 1, endCol: 0 })
        }
      }
      return
    }

    // Enter navigation
    if (e.key === 'Enter') {
      e.preventDefault()
      editingCellRef.current = null
      setEditingCell(null)
      if (e.shiftKey) {
        // Move up
        if (row > 0) {
          setSelection({ startRow: row - 1, startCol: col, endRow: row - 1, endCol: col })
        }
      } else {
        // Move down
        if (row < state.rows.length - 1) {
          setSelection({ startRow: row + 1, startCol: col, endRow: row + 1, endCol: col })
        }
      }
      return
    }

    // Arrow keys
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.shiftKey) {
        // Extend selection down
        setSelection(prev => prev ? {
          ...prev,
          endRow: Math.min(prev.endRow + 1, state.rows.length - 1)
        } : null)
      } else {
        // Move down
        if (row < state.rows.length - 1) {
          setSelection({ startRow: row + 1, startCol: col, endRow: row + 1, endCol: col })
        }
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (e.shiftKey) {
        // Extend selection up
        setSelection(prev => prev ? {
          ...prev,
          endRow: Math.max(prev.endRow - 1, 0)
        } : null)
      } else {
        // Move up
        if (row > 0) {
          setSelection({ startRow: row - 1, startCol: col, endRow: row - 1, endCol: col })
        }
      }
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (e.shiftKey) {
        // Extend selection right
        setSelection(prev => prev ? {
          ...prev,
          endCol: Math.min(prev.endCol + 1, state.columns.length - 1)
        } : null)
      } else {
        // Move right
        if (col < state.columns.length - 1) {
          setSelection({ startRow: row, startCol: col + 1, endRow: row, endCol: col + 1 })
        }
      }
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (e.shiftKey) {
        // Extend selection left
        setSelection(prev => prev ? {
          ...prev,
          endCol: Math.max(prev.endCol - 1, 0)
        } : null)
      } else {
        // Move left
        if (col > 0) {
          setSelection({ startRow: row, startCol: col - 1, endRow: row, endCol: col - 1 })
        }
      }
      return
    }

    // Home - go to start of row
    if (e.key === 'Home') {
      e.preventDefault()
      if (cmdKey) {
        // Go to first cell
        setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })
      } else {
        setSelection({ startRow: row, startCol: 0, endRow: row, endCol: 0 })
      }
      return
    }

    // End - go to end of row
    if (e.key === 'End') {
      e.preventDefault()
      if (cmdKey) {
        // Go to last cell
        setSelection({
          startRow: state.rows.length - 1,
          startCol: state.columns.length - 1,
          endRow: state.rows.length - 1,
          endCol: state.columns.length - 1
        })
      } else {
        setSelection({ startRow: row, startCol: state.columns.length - 1, endRow: row, endCol: state.columns.length - 1 })
      }
      return
    }

    // F2 - enter edit mode
    if (e.key === 'F2') {
      e.preventDefault()
      editingCellRef.current = { row, col, mode: 'doubleclick' }
      setEditingCell({ row, col, mode: 'doubleclick' })
      return
    }

    // Delete/Backspace without editing - clear cell
    if ((e.key === 'Delete' || e.key === 'Backspace') && !editingCell) {
      e.preventDefault()
      clearSelectedCells()
      return
    }
  }, [state.columns.length, state.rows.length, editingCell, clearSelectedCells])

  const gridTemplateColumns = `32px repeat(${state.columns.length}, minmax(80px, 1fr)) 200px`

  // Check if a cell is the primary selected cell (shows drag handle)
  const isPrimarySelected = useCallback((row: number, col: number) => {
    if (!selection) return false
    const sel = getNormalizedSelection(selection)
    if (!sel) return false
    return row === sel.endRow && col === sel.endCol
  }, [selection, getNormalizedSelection])

  // Check if cell is being edited
  const isEditing = useCallback((row: number, col: number) => {
    return editingCell?.row === row && editingCell?.col === col
  }, [editingCell])

  // Handle cell blur to exit editing mode - only clear if this cell was being edited
  const handleCellBlur = useCallback((row: number, col: number) => {
    if (editingCellRef.current?.row === row && editingCellRef.current?.col === col) {
      editingCellRef.current = null
      setEditingCell(null)
    }
  }, [])

  // Handle click on preview/layer icon cells to exit editing
  const handleNonCellClick = useCallback(() => {
    if (editingCell) {
      editingCellRef.current = null
      setEditingCell(null)
    }
    if (editingHeaderIndex !== null) {
      setEditingHeaderIndex(null)
    }
  }, [editingCell, editingHeaderIndex])

  // Handle header navigation (Tab/Enter)
  const handleHeaderNavigate = useCallback((colIndex: number, direction: 'next' | 'prev' | 'down') => {
    setEditingHeaderIndex(null)

    if (direction === 'next') {
      // Move to next header, or first cell if at last header
      if (colIndex < state.columns.length - 1) {
        setEditingHeaderIndex(colIndex + 1)
      } else {
        // Move to first cell
        setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })
        editingCellRef.current = { row: 0, col: 0, mode: 'doubleclick' }
        setEditingCell({ row: 0, col: 0, mode: 'doubleclick' })
      }
    } else if (direction === 'prev') {
      // Move to previous header
      if (colIndex > 0) {
        setEditingHeaderIndex(colIndex - 1)
      }
    } else if (direction === 'down') {
      // Move to first cell of this column
      setSelection({ startRow: 0, startCol: colIndex, endRow: 0, endCol: colIndex })
      editingCellRef.current = { row: 0, col: colIndex, mode: 'doubleclick' }
      setEditingCell({ row: 0, col: colIndex, mode: 'doubleclick' })
    }
  }, [state.columns.length])

  return (
    <div
      className="batch-grid-container"
      tabIndex={0}
      onPaste={handleContainerPaste}
      onKeyDown={handleContainerKeyDown}
    >
      <div ref={containerRef} className="batch-grid-scroll">
      <div className="batch-grid-inner">
        {/* Header row */}
        <div className="batch-grid-header" style={{ gridTemplateColumns }}>
          <div className="header-icon-cell">
            <button
              className="add-column-btn-icon"
              onClick={() => onAddColumn(-1)}
              title="Add column before"
            >
              <Plus size={12} weight="bold" />
            </button>
          </div>
          {state.columns.map((col, colIndex) => (
            <div key={col.id} className="header-cell-wrapper">
              {colIndex === 0 && (
                <button
                  className="add-column-btn-left"
                  onClick={() => onAddColumn(-1)}
                  title="Add column before"
                >
                  <Plus size={12} weight="bold" />
                </button>
              )}
              <ColumnHeader
                header={col.header}
                colIndex={colIndex}
                canDelete={state.columns.length > 1}
                onChange={(header) => onColumnHeaderChange(colIndex, header)}
                onDelete={() => onDeleteColumn(colIndex)}
                onNavigate={(direction) => handleHeaderNavigate(colIndex, direction)}
                isEditingExternal={editingHeaderIndex === colIndex}
                onEditStart={() => {
                  setEditingHeaderIndex(colIndex)
                  editingCellRef.current = null
                  setEditingCell(null)
                }}
                onEditEnd={() => setEditingHeaderIndex(null)}
              />
              <AddColumnButton onClick={() => onAddColumn(colIndex)} />
            </div>
          ))}
          <div className="preview-header">Preview</div>
        </div>

        {/* Data rows */}
        <div className="batch-grid-body">
          {state.rows.map((row, rowIndex) => (
            <div
              key={`${state.sortDirection}-${state.layerIds[rowIndex]}`}
              className="batch-grid-row"
              style={{ gridTemplateColumns, animationDelay: `${rowIndex * 30}ms` }}
            >
              <div
                className="layer-icon-cell"
                onClick={() => {
                  handleNonCellClick()
                  onZoomToLayer(state.layerIds[rowIndex])
                }}
                title="Click to zoom"
              >
                <LayerIcon type={state.layerTypes[rowIndex]} size={14} />
              </div>
              {row.map((cellValue, colIndex) => (
                <GridCell
                  key={`${rowIndex}-${colIndex}`}
                  value={cellValue}
                  rowIndex={rowIndex}
                  colIndex={colIndex}
                  isSelected={isPrimarySelected(rowIndex, colIndex)}
                  isInSelectionRange={isCellInSelection(rowIndex, colIndex)}
                  isInDragRange={isCellInDragRange(rowIndex, colIndex)}
                  isEditing={isEditing(rowIndex, colIndex)}
                  editMode={editingCell?.row === rowIndex && editingCell?.col === colIndex ? editingCell.mode : null}
                  onChange={(value) => onCellChange(rowIndex, colIndex, value)}
                  onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                  onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                  onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                  onDragHandleMouseDown={handleDragHandleMouseDown}
                  onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                  onBlur={(row, col) => handleCellBlur(row, col)}
                />
              ))}
              <div className="preview-cell" onClick={handleNonCellClick}>
                {previewNames[rowIndex]}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
