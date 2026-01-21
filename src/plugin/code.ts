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
  type: 'rename' | 'cancel' | 'close' | 'init' | 'selectNext' | 'selectPrevious' | 'enterFrame'
  name?: string
  originalNames?: string[]
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
  if (newNode && newNode.type !== 'DOCUMENT' && newNode.type !== 'PAGE') {
    figma.currentPage.selection = [newNode as SceneNode]
  }
}

// Show the plugin UI
figma.showUI(__html__, {
  width: 240,
  height: 40,
  themeColors: false,
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
      figma.closePlugin()
      break

    case 'close':
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
  }
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
