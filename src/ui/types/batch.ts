import { LayerType } from '../components/shared/LayerIcon'

// Sort direction for layer ordering
export type SortDirection = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top' | 'reading-order'

// Layer info extended with position data
export interface LayerInfo {
  id: string
  name: string
  x: number
  y: number
  type: LayerType
}

// Column definition
export interface ColumnDef {
  id: string
  header: string
}

// Selection state for drag operations
export interface CellSelection {
  startRow: number
  endRow: number
  colIndex: number
}

// Drag fill handle state
export interface DragFillState {
  isDragging: boolean
  sourceSelection: CellSelection | null
  targetRow: number
}

// Complete grid state
export interface BatchGridState {
  columns: ColumnDef[]
  rows: string[][]  // rows[rowIndex][colIndex] = cell value
  layerIds: string[]  // Parallel array mapping row index to layer ID
  layerTypes: LayerType[]  // Layer types for icons
  sortDirection: SortDirection
}

// Parsed name structure
export interface ParsedName {
  parts: string[]
}

// Series detection
export type SeriesType = 'numeric' | 'alphabetic' | 'constant' | 'mixed'

export interface SeriesInfo {
  type: SeriesType
  values: string[]
  step: number
  // For mixed type (text + number patterns)
  prefix?: string
  suffix?: string
  padLength?: number
}
