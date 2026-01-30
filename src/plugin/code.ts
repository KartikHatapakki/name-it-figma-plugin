// Quick Rename - Figma Plugin Backend
// Handles communication between Figma and the UI

type LayerType = 'frame' | 'text' | 'vector' | 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line' | 'image' | 'component' | 'instance' | 'group' | 'mixed' | 'other'

interface SelectionInfo {
  count: number
  names: string[]
  hasLocked: boolean
  nodeIds: string[]
  layerType: LayerType
}

// Map Figma node type to simplified layer type
function getLayerType(node: SceneNode): LayerType {
  switch (node.type) {
    case 'FRAME':
    case 'SECTION':
      return 'frame'
    case 'GROUP':
      return 'group'
    case 'COMPONENT':
    case 'COMPONENT_SET':
      return 'component'
    case 'INSTANCE':
      return 'instance'
    case 'TEXT':
      return 'text'
    case 'VECTOR':
    case 'BOOLEAN_OPERATION':
      return 'vector'
    case 'LINE':
      return 'line'
    case 'RECTANGLE':
      // Check if it's an image fill
      if ('fills' in node && Array.isArray(node.fills)) {
        const hasImageFill = node.fills.some((fill: Paint) => fill.type === 'IMAGE')
        if (hasImageFill) return 'image'
      }
      return 'rectangle'
    case 'ELLIPSE':
      return 'ellipse'
    case 'POLYGON':
      return 'polygon'
    case 'STAR':
      return 'star'
    default:
      return 'other'
  }
}

interface PluginMessage {
  type: 'rename' | 'cancel' | 'close' | 'init' | 'selectNext' | 'selectPrevious' | 'enterFrame' | 'getLayerPositions' | 'batchRename' | 'resizeUI' | 'zoomToLayer' | 'zoomToSelection' | 'highlightLayer' | 'removeHighlight'
  name?: string
  originalNames?: string[]
  renames?: Array<{ nodeId: string; newName: string }>
  width?: number
  height?: number
  nodeId?: string
}

// Select next or previous sibling in layer hierarchy
function selectSibling(direction: 'next' | 'previous') {
  const selection = figma.currentPage.selection
  if (selection.length !== 1) return

  const currentNode = selection[0]
  const parent = currentNode.parent

  if (!parent || !('children' in parent)) return

  const siblings = parent.children
  const currentIndex = siblings.indexOf(currentNode as SceneNode)

  if (currentIndex === -1) return

  let newIndex: number
  if (direction === 'next') {
    // Next sibling (layer below in Figma's panel - higher index)
    newIndex = currentIndex + 1
    if (newIndex >= siblings.length) {
      newIndex = 0 // Wrap to first
    }
  } else {
    // Previous sibling (layer above in Figma's panel - lower index)
    newIndex = currentIndex - 1
    if (newIndex < 0) {
      newIndex = siblings.length - 1 // Wrap to last
    }
  }

  const newNode = siblings[newIndex]
  if (newNode) {
    figma.currentPage.selection = [newNode]
  }
}

// Show the plugin UI
figma.showUI(__html__, {
  width: 280,
  height: 52,
  themeColors: true,
})

// Get current selection info
function getSelectionInfo(): SelectionInfo {
  const selection = figma.currentPage.selection

  // Determine layer type (mixed if multiple different types)
  let layerType: LayerType = 'other'
  if (selection.length === 1) {
    layerType = getLayerType(selection[0])
  } else if (selection.length > 1) {
    const types = new Set(selection.map(node => getLayerType(node)))
    layerType = types.size === 1 ? getLayerType(selection[0]) : 'mixed'
  }

  return {
    count: selection.length,
    names: selection.map(node => node.name),
    hasLocked: selection.some(node => node.locked),
    nodeIds: selection.map(node => node.id),
    layerType: layerType,
  }
}

// Send selection info to UI
function sendSelectionToUI() {
  const info = getSelectionInfo()
  figma.ui.postMessage({
    type: 'selection',
    count: info.count,
    names: info.names,
    hasLocked: info.hasLocked,
    nodeIds: info.nodeIds,
    layerType: info.layerType,
  })
}

// Initial send
sendSelectionToUI()

// Clean up any stale highlights from previous sessions
cleanupStaleHighlights()

// Listen for selection changes
figma.on('selectionchange', () => {
  sendSelectionToUI()
})

// Handle messages from UI
figma.ui.onmessage = (msg: PluginMessage) => {
  const selection = figma.currentPage.selection

  switch (msg.type) {
    case 'rename':
      // Rename all selected layers
      if (msg.name !== undefined && msg.name.length > 0) {
        for (const node of selection) {
          if (!node.locked) {
            node.name = msg.name
          }
        }
      }
      break

    case 'cancel':
      // Revert to original names
      if (msg.originalNames && msg.originalNames.length === selection.length) {
        selection.forEach((node, index) => {
          if (!node.locked && msg.originalNames) {
            node.name = msg.originalNames[index]
          }
        })
      }
      // Clean up highlight synchronously before closing
      removeHighlightSync()
      figma.closePlugin()
      break

    case 'close':
      // Clean up highlight synchronously before closing
      removeHighlightSync()
      figma.closePlugin()
      break

    case 'init':
      sendSelectionToUI()
      break

    case 'selectNext':
      selectSibling('next')
      break

    case 'selectPrevious':
      selectSibling('previous')
      break

    case 'enterFrame':
      enterFrame()
      break

    case 'getLayerPositions':
      getLayerPositions()
      break

    case 'batchRename':
      if (msg.renames) {
        handleBatchRename(msg.renames)
      }
      break

    case 'resizeUI':
      if (msg.width && msg.height) {
        figma.ui.resize(msg.width, msg.height)
      }
      break

    case 'zoomToLayer':
      if (msg.nodeId) {
        zoomToLayer(msg.nodeId)
      }
      break

    case 'zoomToSelection':
      zoomToSelection()
      break

    case 'highlightLayer':
      if (msg.nodeId) {
        showLayerHighlight(msg.nodeId)
      }
      break

    case 'removeHighlight':
      removeHighlightSync()
      break
  }
}

// Track zoom state
let isZooming = false
let lastZoomTarget: { x: number; y: number } | null = null

// Highlight feature constant
const HIGHLIGHT_NODE_NAME = '__name-it-highlight__'

// Remove highlight - multiple methods for reliability
function removeAllHighlights() {
  // Method 1: Use stored node ID
  try {
    const storedId = figma.root.getPluginData('highlightNodeId')
    if (storedId && storedId.length > 0) {
      const node = figma.getNodeById(storedId)
      if (node) node.remove()
      figma.root.setPluginData('highlightNodeId', '')
    }
  } catch (_) {}

  // Method 2: Directly iterate current page children (most reliable)
  try {
    const toRemove: SceneNode[] = []
    for (const child of figma.currentPage.children) {
      if (child.name === HIGHLIGHT_NODE_NAME || child.name.includes('name-it-highlight')) {
        toRemove.push(child)
      }
    }
    for (const node of toRemove) {
      try { node.remove() } catch (_) {}
    }
  } catch (_) {}

  // Method 3: Use findAll on current page (recursive search)
  try {
    const highlights = figma.currentPage.findAll(node =>
      node.name === HIGHLIGHT_NODE_NAME || node.name.includes('name-it-highlight')
    )
    for (const node of highlights) {
      try { node.remove() } catch (_) {}
    }
  } catch (_) {}

  // Method 4: Check all pages
  for (const page of figma.root.children) {
    if (page.type === 'PAGE') {
      try {
        // Direct children
        const toRemove: SceneNode[] = []
        for (const child of page.children) {
          if (child.name === HIGHLIGHT_NODE_NAME || child.name.includes('name-it-highlight')) {
            toRemove.push(child)
          }
        }
        for (const node of toRemove) {
          try { node.remove() } catch (_) {}
        }
        // Also recursive search
        const pageHighlights = page.findAll(node =>
          node.name === HIGHLIGHT_NODE_NAME || node.name.includes('name-it-highlight')
        )
        for (const node of pageHighlights) {
          try { node.remove() } catch (_) {}
        }
      } catch (_) {}
    }
  }
}

// Cleanup on init - silently removes any stale highlights
function cleanupStaleHighlights() {
  removeAllHighlights()
}

// Alias for sync removal
function removeHighlightSync() {
  removeAllHighlights()
}

// Create highlight around a layer (removes existing first)
async function showLayerHighlight(nodeId: string) {
  // Always remove existing highlights first
  removeAllHighlights()

  try {
    const node = await figma.getNodeByIdAsync(nodeId)
    if (!node || !('absoluteBoundingBox' in node)) return

    const sceneNode = node as SceneNode
    const bounds = sceneNode.absoluteBoundingBox
    if (!bounds) return

    // Calculate zoom-adjusted values
    const zoom = figma.viewport.zoom
    const baseStrokeWeight = 4
    const basePadding = 8
    const baseCornerRadius = 4
    const scale = Math.max(0.5, Math.min(8, 1 / zoom))
    const strokeWeight = baseStrokeWeight * scale
    const padding = basePadding * scale
    const cornerRadius = baseCornerRadius * scale

    // Create highlight at PAGE ROOT level (not inside any frame)
    const highlight = figma.createRectangle()
    figma.currentPage.appendChild(highlight)  // Explicitly add to page root

    highlight.name = HIGHLIGHT_NODE_NAME
    highlight.fills = []
    highlight.strokes = [{ type: 'SOLID', color: { r: 0.13, g: 0.77, b: 0.37 } }]
    highlight.strokeWeight = strokeWeight
    highlight.strokeAlign = 'OUTSIDE'
    highlight.cornerRadius = cornerRadius
    highlight.x = bounds.x - padding
    highlight.y = bounds.y - padding
    highlight.resize(bounds.width + padding * 2, bounds.height + padding * 2)

    // Store the highlight ID for reliable cleanup later
    figma.root.setPluginData('highlightNodeId', highlight.id)
  } catch (_) {
    removeAllHighlights()
  }
}


// Subtle shake effect when already at target
async function shakeViewport() {
  const center = figma.viewport.center
  const shakeAmount = 8
  const steps = [
    { x: shakeAmount, y: 0 },
    { x: -shakeAmount, y: 0 },
    { x: shakeAmount / 2, y: 0 },
    { x: -shakeAmount / 2, y: 0 },
    { x: 0, y: 0 }
  ]

  for (const offset of steps) {
    figma.viewport.center = { x: center.x + offset.x, y: center.y + offset.y }
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  figma.viewport.center = center
}

// Zoom to fit all selected layers
async function zoomToSelection() {
  if (isZooming) return
  isZooming = true

  try {
    const selection = figma.currentPage.selection
    if (selection.length === 0) {
      isZooming = false
      return
    }

    // Calculate center of selection for shake detection
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const node of selection) {
      if (node.absoluteBoundingBox) {
        const bounds = node.absoluteBoundingBox
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.x + bounds.width)
        maxY = Math.max(maxY, bounds.y + bounds.height)
      }
    }

    if (minX === Infinity) {
      isZooming = false
      return
    }

    const targetX = (minX + maxX) / 2
    const targetY = (minY + maxY) / 2

    // Check if already at target
    const currentCenter = figma.viewport.center
    const tolerance = 50
    const alreadyAtTarget = lastZoomTarget &&
      Math.abs(currentCenter.x - targetX) < tolerance &&
      Math.abs(currentCenter.y - targetY) < tolerance

    if (alreadyAtTarget) {
      await shakeViewport()
      isZooming = false
      return
    }

    // Save current viewport state
    const startCenter = figma.viewport.center
    const startZoom = figma.viewport.zoom

    // Use Figma's scrollAndZoomIntoView to get target state
    figma.viewport.scrollAndZoomIntoView(selection)

    // Capture target state
    const endCenter = figma.viewport.center
    const endZoom = figma.viewport.zoom

    // Restore start state
    figma.viewport.center = startCenter
    figma.viewport.zoom = startZoom

    // Animate to target
    const steps = 15
    const duration = 20

    for (let i = 1; i <= steps; i++) {
      const t = easeOutCubic(i / steps)
      figma.viewport.center = {
        x: startCenter.x + (endCenter.x - startCenter.x) * t,
        y: startCenter.y + (endCenter.y - startCenter.y) * t
      }
      figma.viewport.zoom = startZoom + (endZoom - startZoom) * t
      await new Promise(resolve => setTimeout(resolve, duration))
    }

    // Remember where we zoomed to
    lastZoomTarget = { x: targetX, y: targetY }
  } finally {
    isZooming = false
  }
}

// Smooth zoom to a specific layer - fits entire layer in viewport
async function zoomToLayer(nodeId: string) {
  // Prevent double-triggering while animating
  if (isZooming) return
  isZooming = true

  try {
    const node = await figma.getNodeByIdAsync(nodeId)
    if (!node || !('absoluteBoundingBox' in node)) {
      isZooming = false
      return
    }

    const sceneNode = node as SceneNode
    const bounds = sceneNode.absoluteBoundingBox
    if (!bounds) {
      isZooming = false
      return
    }

    // Save current viewport state
    const startCenter = figma.viewport.center
    const startZoom = figma.viewport.zoom

    // Use Figma's scrollAndZoomIntoView to calculate optimal zoom that fits the layer
    figma.viewport.scrollAndZoomIntoView([sceneNode])

    // Capture the target state (this fits the layer properly)
    const endCenter = figma.viewport.center
    // Zoom out a bit more (60% of Figma's calculated zoom) for breathing room
    const endZoom = figma.viewport.zoom * 0.6

    // Restore start state for animation
    figma.viewport.center = startCenter
    figma.viewport.zoom = startZoom

    // Animate over ~300ms (12 steps)
    const steps = 12
    const duration = 25

    for (let i = 1; i <= steps; i++) {
      const t = easeOutCubic(i / steps)

      const newX = startCenter.x + (endCenter.x - startCenter.x) * t
      const newY = startCenter.y + (endCenter.y - startCenter.y) * t
      const newZoom = startZoom + (endZoom - startZoom) * t

      figma.viewport.center = { x: newX, y: newY }
      figma.viewport.zoom = newZoom

      await new Promise(resolve => setTimeout(resolve, duration))
    }
  } finally {
    isZooming = false
  }
}

// Easing function for smooth animation
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// Enter into frame (select children) - like Figma's native Enter
function enterFrame() {
  const selection = figma.currentPage.selection
  if (selection.length !== 1) return

  const node = selection[0]

  // Check if node has children
  if ('children' in node && node.children.length > 0) {
    // Select all children inside the frame
    figma.currentPage.selection = [...node.children] as SceneNode[]
  }
}

// Get layer positions for batch rename sorting
function getLayerPositions() {
  const selection = figma.currentPage.selection

  const layers = selection.map(node => {
    let x = 0
    let y = 0

    // Try absoluteBoundingBox first
    if (node.absoluteBoundingBox) {
      x = node.absoluteBoundingBox.x
      y = node.absoluteBoundingBox.y
    } else if ('x' in node && 'y' in node) {
      // Fallback to x/y properties
      x = (node as any).x
      y = (node as any).y
    }

    return {
      id: node.id,
      name: node.name,
      x: x,
      y: y,
      type: getLayerType(node),
    }
  })

  figma.ui.postMessage({
    type: 'layerPositions',
    layers,
  })
}

// Batch rename multiple layers
async function handleBatchRename(renames: Array<{ nodeId: string; newName: string }>) {
  for (const { nodeId, newName } of renames) {
    const node = await figma.getNodeByIdAsync(nodeId)
    if (node && 'name' in node) {
      const sceneNode = node as SceneNode
      if (!sceneNode.locked) {
        sceneNode.name = newName
      }
    }
  }
}
