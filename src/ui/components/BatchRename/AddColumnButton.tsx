import { Plus } from '@phosphor-icons/react'

interface AddColumnButtonProps {
  onClick: () => void
}

export function AddColumnButton({ onClick }: AddColumnButtonProps) {
  return (
    <button
      className="add-column-btn"
      onClick={onClick}
      title="Add column"
    >
      <Plus size={12} weight="bold" />
    </button>
  )
}
