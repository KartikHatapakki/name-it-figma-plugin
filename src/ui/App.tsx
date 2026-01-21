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
  const iconProps = { size: 16, weight: 'regular' as const, className: 'text-[#9d9d9d]' }

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
  const containerRef = useRef<HTMLDivElement>(null)

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
      setTimeout(() => {
        if (inputRef.current && newSelection.count > 0) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
    }

    window.addEventListener('message', handleMessage)

    // Request initial selection
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])


  // Auto-focus container when no selection
  useEffect(() => {
    if (selection.count === 0 && containerRef.current) {
      containerRef.current.focus()
    }
  }, [selection.count])

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
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Live rename with debounce
    if (value.length > 0) {
      debouncedRename(value)
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

  // No selection state
  if (selection.count === 0) {
    return (
      <div
        ref={containerRef}
        className="h-full flex items-center px-3 cursor-pointer outline-none"
        onClick={() => containerRef.current?.focus()}
        tabIndex={0}
        autoFocus
      >
        <p className="text-white/50 text-[13px]">
          Select layer(s) to name
        </p>
      </div>
    )
  }

  return (
    <div
      className="h-full cursor-text flex items-center"
      onClick={handleContainerClick}
    >
      <div className="flex items-center gap-2 px-3 w-full">
        {/* Layer type icon with count badge */}
        <div className="relative flex-shrink-0">
          <LayerIcon type={selection.layerType} />
          {selection.count > 1 && (
            <span
              className={`absolute -top-1.5 -right-2 text-[10px] text-[#ccc] bg-[#3d3d3d] px-1 min-w-[16px] text-center rounded-full border border-[#555] transition-transform duration-100 ${isAnimating ? 'scale-110' : 'scale-100'}`}
            >
              {displayCount}
            </span>
          )}
        </div>

        {/* Input field - minimal style like Figma */}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Rename"
          className={`flex-1 bg-transparent border-none outline-none text-[13px] text-white placeholder:text-[#6d6d6d] ${selection.count > 1 ? 'ml-2' : 'ml-0.5'}`}
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
