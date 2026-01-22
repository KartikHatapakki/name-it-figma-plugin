import { useEffect, useState, useRef, useCallback } from 'react'
import {
  FrameCorners,
  TextT,
  BezierCurve,
  Square,
  Circle,
  Polygon,
  Star,
  LineSegment,
  Image,
  Cube,
  Copy,
  FolderSimple,
  Stack,
  CursorClick,
} from '@phosphor-icons/react'

type LayerType = 'frame' | 'text' | 'vector' | 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line' | 'image' | 'component' | 'instance' | 'group' | 'mixed' | 'other'

interface SelectionInfo {
  count: number
  names: string[]
  hasLocked: boolean
  nodeIds: string[]
  layerType: LayerType
}

// Icon component based on layer type
function LayerIcon({ type }: { type: LayerType }) {
  const iconProps = { size: 16, weight: 'regular' as const, style: { color: 'var(--color-text-secondary)' } }

  switch (type) {
    case 'frame':
      return <FrameCorners {...iconProps} />
    case 'text':
      return <TextT {...iconProps} />
    case 'vector':
      return <BezierCurve {...iconProps} />
    case 'rectangle':
      return <Square {...iconProps} />
    case 'ellipse':
      return <Circle {...iconProps} />
    case 'polygon':
      return <Polygon {...iconProps} />
    case 'star':
      return <Star {...iconProps} />
    case 'line':
      return <LineSegment {...iconProps} />
    case 'image':
      return <Image {...iconProps} />
    case 'component':
      return <Cube {...iconProps} />
    case 'instance':
      return <Copy {...iconProps} />
    case 'group':
      return <FolderSimple {...iconProps} />
    case 'mixed':
      return <Stack {...iconProps} />
    default:
      return <CursorClick {...iconProps} />
  }
}

// Debounce helper
function useDebounce<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  ) as T

  return debouncedCallback
}

export default function App() {
  const [selection, setSelection] = useState<SelectionInfo>({
    count: 0,
    names: [],
    hasLocked: false,
    nodeIds: [],
    layerType: 'other',
  })
  const [inputValue, setInputValue] = useState('')
  const [displayCount, setDisplayCount] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldSelectAllRef = useRef(false)

  // Robust focus and select - works on both desktop and browser
  const focusAndSelect = useCallback(() => {
    if (!inputRef.current) return

    shouldSelectAllRef.current = true

    // Multiple attempts to ensure it works in browser iframe
    const attemptFocus = () => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }

    // Try immediately
    attemptFocus()

    // Try after a frame (helps with browser)
    requestAnimationFrame(() => {
      attemptFocus()
      // Try once more after a short delay (browser iframe needs this)
      setTimeout(attemptFocus, 50)
    })
  }, [])

  // Debounced rename function
  const debouncedRename = useDebounce((name: string) => {
    parent.postMessage(
      { pluginMessage: { type: 'rename', name } },
      '*'
    )
  }, 150)

  // Handle messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage
      if (!msg || msg.type !== 'selection') return

      const newSelection: SelectionInfo = {
        count: msg.count,
        names: msg.names,
        hasLocked: msg.hasLocked,
        nodeIds: msg.nodeIds,
        layerType: msg.layerType || 'other',
      }

      setSelection(newSelection)

      // Update input when selection changes
      if (newSelection.count === 1) {
        setInputValue(newSelection.names[0])
      } else if (newSelection.count > 1) {
        setInputValue('')
      } else {
        setInputValue('')
      }

      // Auto-focus and select after state update
      if (newSelection.count > 0) {
        focusAndSelect()
      }
    }

    window.addEventListener('message', handleMessage)

    // Request initial selection
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [focusAndSelect])

  // Focus input on mount
  useEffect(() => {
    focusAndSelect()
  }, [focusAndSelect])


  // Select text after input value has been rendered (fixes race condition)
  useEffect(() => {
    if (selection.count > 0 && shouldSelectAllRef.current && inputRef.current) {
      // Wait for React to render the new value, then select
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selection.nodeIds.join(',')])

  // Animate count when it changes
  useEffect(() => {
    const targetCount = selection.count
    if (targetCount === displayCount) return

    setIsAnimating(true)

    // Quick counter animation
    const diff = targetCount - displayCount
    const steps = Math.min(Math.abs(diff), 10)
    const stepSize = diff / steps
    let current = displayCount
    let step = 0

    const interval = setInterval(() => {
      step++
      if (step >= steps) {
        setDisplayCount(targetCount)
        setIsAnimating(false)
        clearInterval(interval)
      } else {
        current += stepSize
        setDisplayCount(Math.round(current))
      }
    }, 30)

    return () => clearInterval(interval)
  }, [selection.count])

  // Focus input when clicking anywhere on the plugin
  const handleContainerClick = () => {
    focusAndSelect()
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // User is typing, don't auto-select anymore
    shouldSelectAllRef.current = false

    // Live rename with debounce
    if (value.length > 0) {
      debouncedRename(value)
    }
  }

  // Handle focus - select all text when input is focused
  const handleFocus = () => {
    if (shouldSelectAllRef.current && inputRef.current) {
      // Multiple attempts to select - browser iframes can be tricky
      inputRef.current.select()
      setTimeout(() => inputRef.current?.select(), 0)
      setTimeout(() => inputRef.current?.select(), 10)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      // Final rename before switching
      if (inputValue.length > 0) {
        parent.postMessage(
          { pluginMessage: { type: 'rename', name: inputValue } },
          '*'
        )
      }
      // Select next or previous sibling
      if (e.shiftKey) {
        parent.postMessage(
          { pluginMessage: { type: 'selectPrevious' } },
          '*'
        )
      } else {
        parent.postMessage(
          { pluginMessage: { type: 'selectNext' } },
          '*'
        )
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Final rename (in case debounce hasn't fired)
      if (inputValue.length > 0) {
        parent.postMessage(
          { pluginMessage: { type: 'rename', name: inputValue } },
          '*'
        )
      }
      // Enter into frame (select children) - like Figma's native Enter
      parent.postMessage(
        { pluginMessage: { type: 'enterFrame' } },
        '*'
      )
    }
  }

  // Always render the input so inputRef is always available
  return (
    <div
      className="h-full cursor-text flex items-center"
      onClick={handleContainerClick}
    >
      <div className="flex items-center gap-2 px-3 w-full">
        {/* Layer type icon with count badge - only show when selection exists */}
        {selection.count > 0 && (
          <div className="relative flex-shrink-0">
            <LayerIcon type={selection.layerType} />
            {selection.count > 1 && (
              <span
                className={`absolute -top-1.5 -right-2 text-[10px] px-1 min-w-[16px] text-center rounded-full border transition-transform duration-100 ${isAnimating ? 'scale-110' : 'scale-100'}`}
                style={{
                  color: 'var(--color-text)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {displayCount}
              </span>
            )}
          </div>
        )}

        {/* Input field - always rendered, placeholder changes based on selection */}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          disabled={selection.count === 0}
          placeholder={selection.count === 0 ? "Select layer(s) to name" : "Rename"}
          className={`flex-1 bg-transparent border-none outline-none text-[13px] ${selection.count > 1 ? 'ml-2' : 'ml-0.5'} ${selection.count === 0 ? 'cursor-default' : ''}`}
          style={{
            color: 'var(--color-text)',
          }}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  )
}
