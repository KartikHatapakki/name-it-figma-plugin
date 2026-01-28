import { useRef, useEffect, useCallback } from 'react'

interface GridCellProps {
  value: string
  rowIndex: number
  colIndex: number
  isSelected: boolean
  isInSelectionRange: boolean
  isInDragRange: boolean
  isEditing: boolean
  editMode?: 'typing' | 'doubleclick' | null
  onChange: (value: string) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onDoubleClick: () => void
  onDragHandleMouseDown: (e: React.MouseEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onBlur?: (row: number, col: number) => void
}

export function GridCell({
  value,
  rowIndex,
  colIndex,
  isSelected,
  isInSelectionRange,
  isInDragRange,
  isEditing,
  editMode,
  onChange,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onDragHandleMouseDown,
  onKeyDown,
  onBlur,
}: GridCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus and position cursor when entering edit mode
  useEffect(() => {
    if (!isEditing || !inputRef.current) return

    inputRef.current.focus()
    if (editMode === 'typing') {
      const len = inputRef.current.value.length
      inputRef.current.setSelectionRange(len, len)
    } else {
      inputRef.current.select()
    }
  }, [isEditing, editMode])

  const handleInputMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isSelected && !isEditing) {
      e.preventDefault()
    }
  }, [isSelected, isEditing])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdKey = isMac ? e.metaKey : e.ctrlKey
    const input = inputRef.current

    // Backspace/Delete handling
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (input?.value.length) {
        e.stopPropagation()
        return
      }
      onKeyDown(e)
      return
    }

    if (isEditing) {
      // Arrow keys for text navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopPropagation()
        return
      }
      // Cmd+A/C/X/V for text operations
      if (cmdKey && ['a', 'c', 'x', 'v'].includes(e.key)) {
        e.stopPropagation()
        return
      }
      // Navigation keys bubble up
      if (['Enter', 'Tab', 'Escape'].includes(e.key)) {
        onKeyDown(e)
        return
      }
      // All other keys handled by input
      e.stopPropagation()
      return
    }

    onKeyDown(e)
  }, [isEditing, onKeyDown])

  const cellClass = [
    'batch-grid-cell',
    isSelected && 'selected',
    isInSelectionRange && !isSelected && 'in-selection',
    isInDragRange && 'in-drag-range',
    isEditing && 'editing',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cellClass}
      data-row={rowIndex}
      data-col={colIndex}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={handleInputMouseDown}
        onKeyDown={handleKeyDown}
        onBlur={() => onBlur?.(rowIndex, colIndex)}
        spellCheck={false}
        autoComplete="off"
      />
      {isSelected && (
        <div className="drag-handle" onMouseDown={onDragHandleMouseDown} />
      )}
    </div>
  )
}
