import { SortDirection } from '../../types/batch'

interface DirectionPickerProps {
  direction: SortDirection
  onChange: (direction: SortDirection) => void
}

// Horizontal/Reading order icon - Z pattern
function HorizontalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 3H11L3 11H12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head at end */}
      <path
        d="M10 9L12 11L10 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Vertical/Column order icon - two columns top to bottom
function VerticalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      {/* First column arrow down */}
      <path
        d="M4 2V10M4 10L2 8M4 10L6 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Second column arrow down */}
      <path
        d="M10 2V10M10 10L8 8M10 10L12 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const directions: { direction: SortDirection; Icon: () => JSX.Element; label: string }[] = [
  { direction: 'reading-order', Icon: HorizontalIcon, label: 'Row order (left to right, top to bottom)' },
  { direction: 'top-to-bottom', Icon: VerticalIcon, label: 'Column order (top to bottom, left to right)' },
]

export function DirectionPicker({ direction, onChange }: DirectionPickerProps) {
  const handleClick = (dir: SortDirection) => {
    onChange(dir)
  }

  // Calculate slider position based on active direction
  const activeIndex = directions.findIndex(d => d.direction === direction)

  return (
    <div className="direction-picker">
      <span className="direction-label">Renaming order</span>
      <div className="direction-buttons">
        {/* Sliding indicator */}
        <div
          className="direction-slider"
          style={{ transform: `translateX(${activeIndex * 30}px)` }}
        />
        {directions.map(({ direction: dir, Icon, label }) => (
          <button
            key={dir}
            onClick={() => handleClick(dir)}
            className={`direction-btn ${direction === dir ? 'active' : ''}`}
            title={label}
            type="button"
          >
            <Icon />
          </button>
        ))}
      </div>
    </div>
  )
}
