import { LayerInfo, SortDirection } from '../types/batch'

export function sortLayersByDirection(
  layers: LayerInfo[],
  direction: SortDirection
): LayerInfo[] {
  const sorted = [...layers]

  // Calculate adaptive threshold based on layer sizes
  const getThreshold = () => {
    if (layers.length < 2) return 20
    // Use average layer height/width as threshold
    const avgHeight = layers.reduce((sum, l) => sum + 50, 0) / layers.length // Assume ~50px average
    return Math.max(20, avgHeight * 0.5)
  }

  const threshold = getThreshold()

  switch (direction) {
    case 'left-to-right':
      sorted.sort((a, b) => a.x - b.x || a.y - b.y)
      break
    case 'right-to-left':
      sorted.sort((a, b) => b.x - a.x || a.y - b.y)
      break
    case 'top-to-bottom':
      // N-pattern: Column by column (group by X/column, then sort by Y within column)
      sorted.sort((a, b) => {
        const colA = Math.floor(a.x / threshold)
        const colB = Math.floor(b.x / threshold)

        if (colA !== colB) {
          return colA - colB // Sort by column first
        }
        return a.y - b.y // Then by Y within same column
      })
      break
    case 'bottom-to-top':
      sorted.sort((a, b) => b.y - a.y || a.x - b.x)
      break
    case 'reading-order':
      // Z-pattern: Row by row (group by Y/row, then sort by X within row)
      sorted.sort((a, b) => {
        const rowA = Math.floor(a.y / threshold)
        const rowB = Math.floor(b.y / threshold)

        if (rowA !== rowB) {
          return rowA - rowB // Sort by row first
        }
        return a.x - b.x // Then by X within same row
      })
      break
  }

  return sorted
}
