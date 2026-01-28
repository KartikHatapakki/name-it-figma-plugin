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

export type LayerType = 'frame' | 'text' | 'vector' | 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line' | 'image' | 'component' | 'instance' | 'group' | 'mixed' | 'other'

interface LayerIconProps {
  type: LayerType
  size?: number
  color?: string
}

export function LayerIcon({ type, size = 16, color = 'var(--color-icon)' }: LayerIconProps) {
  const iconProps = { size, weight: 'regular' as const, style: { color } }

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
