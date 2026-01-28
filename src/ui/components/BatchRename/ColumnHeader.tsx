import { useState, useRef, useEffect } from 'react'
import { X } from '@phosphor-icons/react'

interface ColumnHeaderProps {
  header: string
  colIndex: number
  canDelete: boolean
  onChange: (header: string) => void
  onDelete: () => void
  onNavigate?: (direction: 'next' | 'prev' | 'down') => void
  isEditingExternal?: boolean
  onEditStart?: () => void
  onEditEnd?: () => void
}

export function ColumnHeader({
  header,
  colIndex,
  canDelete,
  onChange,
  onDelete,
  onNavigate,
  isEditingExternal,
  onEditStart,
  onEditEnd,
}: ColumnHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(header)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync editValue with header prop
  useEffect(() => {
    if (!isEditing) setEditValue(header)
  }, [header, isEditing])

  // Sync with external editing control
  useEffect(() => {
    if (isEditingExternal && !isEditing) {
      setEditValue(header)
      setIsEditing(true)
    } else if (!isEditingExternal && isEditing) {
      setIsEditing(false)
    }
  }, [isEditingExternal])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const saveAndExit = () => {
    setIsEditing(false)
    if (editValue.trim()) {
      onChange(editValue.trim())
    } else {
      setEditValue(header)
    }
    onEditEnd?.()
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setEditValue(header)
    setIsEditing(true)
    onEditStart?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()

    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        saveAndExit()
        onNavigate?.(e.shiftKey ? 'prev' : 'next')
        break
      case 'Enter':
        e.preventDefault()
        saveAndExit()
        onNavigate?.('down')
        break
      case 'Escape':
        e.preventDefault()
        setEditValue(header)
        setIsEditing(false)
        break
    }
  }

  return (
    <div
      className={`column-header ${isEditing ? 'editing' : ''}`}
      onClick={handleClick}
    >
      <div className="header-content">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveAndExit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="header-input"
          />
        ) : (
          <span className="header-text">{header}</span>
        )}
      </div>
      {canDelete && (
        <button
          className="delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Delete column"
        >
          <X size={14} weight="bold" />
        </button>
      )}
    </div>
  )
}
