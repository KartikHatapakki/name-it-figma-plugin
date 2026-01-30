import { useEffect, useState, useRef, useCallback } from 'react'
import { LayerIcon, LayerType } from './components/shared/LayerIcon'
import { BatchRename } from './components/BatchRename'
import { useDebounce } from './hooks/useDebounce'
import { LayerInfo } from './types/batch'

interface SelectionInfo {
  count: number
  names: string[]
  hasLocked: boolean
  nodeIds: string[]
  layerType: LayerType
}

export default function App() {
  const [mode, setMode] = useState<'quick' | 'batch'>('quick')
  const [selection, setSelection] = useState<SelectionInfo>({
    count: 0,
    names: [],
    hasLocked: false,
    nodeIds: [],
    layerType: 'other',
  })
  const [batchLayers, setBatchLayers] = useState<LayerInfo[]>([])
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

  // Ref to track current mode for message handler
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  // Handle messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage
      if (!msg) return

      if (msg.type === 'selection') {
        const newSelection: SelectionInfo = {
          count: msg.count,
          names: msg.names,
          hasLocked: msg.hasLocked,
          nodeIds: msg.nodeIds,
          layerType: msg.layerType || 'other',
        }

        setSelection(newSelection)

        // Update input when selection changes (only in quick mode)
        if (modeRef.current === 'quick') {
          setInputValue(newSelection.count === 1 ? newSelection.names[0] : '')
          if (newSelection.count > 0) focusAndSelect()
        }

        // If in batch mode and selection changed, request positions
        if (modeRef.current === 'batch' && newSelection.count > 0) {
          parent.postMessage({ pluginMessage: { type: 'getLayerPositions' } }, '*')
        }
      } else if (msg.type === 'layerPositions') {
        setBatchLayers(msg.layers)
      }
    }

    window.addEventListener('message', handleMessage)

    // Request initial selection (only once on mount)
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [focusAndSelect])

  // Cleanup highlight when plugin window closes (multiple events for reliability)
  useEffect(() => {
    const cleanup = () => {
      parent.postMessage({ pluginMessage: { type: 'removeHighlight' } }, '*')
    }

    // Try multiple events - one should fire when plugin closes
    window.addEventListener('beforeunload', cleanup)
    window.addEventListener('unload', cleanup)
    window.addEventListener('pagehide', cleanup)

    // Also cleanup on component unmount
    return () => {
      cleanup()
      window.removeEventListener('beforeunload', cleanup)
      window.removeEventListener('unload', cleanup)
      window.removeEventListener('pagehide', cleanup)
    }
  }, [])

  // Focus input on mount (quick mode only)
  useEffect(() => {
    if (mode === 'quick') {
      focusAndSelect()
    }
  }, [focusAndSelect, mode])

  // Select text after input value has been rendered (fixes race condition)
  useEffect(() => {
    if (mode === 'quick' && selection.count > 0 && shouldSelectAllRef.current && inputRef.current) {
      // Wait for React to render the new value, then select
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [mode, selection.nodeIds.join(',')])

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

  // Resize UI based on selection count (quick mode only)
  useEffect(() => {
    if (mode === 'quick') {
      if (selection.count > 1) {
        parent.postMessage({ pluginMessage: { type: 'resizeUI', width: 280, height: 86 } }, '*')
      } else {
        parent.postMessage({ pluginMessage: { type: 'resizeUI', width: 280, height: 52 } }, '*')
      }
    }
  }, [selection.count, mode])

  // Switch to batch mode with animation
  const handleSwitchToBatch = useCallback(() => {
    // Request layer positions first
    parent.postMessage({ pluginMessage: { type: 'getLayerPositions' } }, '*')
    // Resize then switch mode
    parent.postMessage({ pluginMessage: { type: 'resizeUI', width: 500, height: 300 } }, '*')
    setMode('batch')
  }, [])

  // Switch to quick mode with animation
  const handleSwitchToQuick = useCallback(() => {
    // Remove highlight when leaving batch mode
    parent.postMessage({ pluginMessage: { type: 'removeHighlight' } }, '*')
    setMode('quick')
    // Resize UI for quick mode
    parent.postMessage({ pluginMessage: { type: 'resizeUI', width: 280, height: 86 } }, '*')
  }, [])

  // Handle batch rename apply (stays on batch view)
  const handleBatchApply = useCallback((renames: Array<{ nodeId: string; newName: string }>) => {
    parent.postMessage({ pluginMessage: { type: 'batchRename', renames } }, '*')
  }, [])

  // Handle zoom to selected layers (zooms to fit all selected)
  const handleZoomToLayer = useCallback(() => {
    if (selection.nodeIds.length > 0) {
      parent.postMessage({ pluginMessage: { type: 'zoomToSelection' } }, '*')
    }
  }, [selection.nodeIds])

  // Focus input when clicking anywhere on the plugin (quick mode)
  const handleContainerClick = () => {
    if (mode === 'quick') {
      focusAndSelect()
    }
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

  // Helper to send plugin messages
  const postMessage = (type: string, data?: object) => {
    parent.postMessage({ pluginMessage: { type, ...data } }, '*')
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (inputValue) postMessage('rename', { name: inputValue })
      postMessage(e.shiftKey ? 'selectPrevious' : 'selectNext')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue) postMessage('rename', { name: inputValue })
      postMessage('enterFrame')
    }
  }

  // Batch mode
  if (mode === 'batch') {
    return (
      <BatchRename
        layers={batchLayers}
        onApply={handleBatchApply}
        onCancel={handleSwitchToQuick}
      />
    )
  }

  // Quick mode (original UI)
  return (
    <div
      className={`h-full cursor-text flex flex-col px-4 mode-transition ${selection.count <= 1 ? 'justify-center py-3' : 'pt-4 pb-2'}`}
      onClick={handleContainerClick}
    >
      {/* Input row */}
      <div className="flex items-center gap-2.5">
        {/* Layer type icon with count badge - only show when selection exists */}
        {selection.count > 0 && (
          <div
            className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              handleZoomToLayer()
            }}
            title="Click to zoom to selection"
          >
            <LayerIcon type={selection.layerType} />
            {selection.count > 1 && (
              <span
                className={`layer-count-pill transition-transform duration-100 ${isAnimating ? 'scale-110' : 'scale-100'}`}
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
          placeholder={selection.count === 0 ? "Select layer(s) to name" : selection.count > 1 ? "Rename selected layers" : "Rename"}
          className={`flex-1 bg-transparent border-none outline-none text-[13px] ${selection.count === 0 ? 'cursor-default' : ''}`}
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

      {/* Batch naming button - only show when multiple layers selected */}
      {selection.count > 1 && (
        <button
          className="advanced-btn mt-3"
          onClick={(e) => {
            e.stopPropagation()
            handleSwitchToBatch()
          }}
        >
          Advanced Naming
        </button>
      )}
    </div>
  )
}
