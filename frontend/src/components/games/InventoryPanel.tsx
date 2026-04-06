export type InventoryItem = {
  id: string
  item_name: string
  quantity: number
}

interface InventoryPanelProps {
  items: InventoryItem[]
}

export function InventoryPanel({ items }: InventoryPanelProps) {
  if (items.length === 0) {
    return (
      <div className="dnd-card p-6" data-testid="inventory-panel">
        <div className="text-center py-4" data-testid="inventory-empty">
          <span className="text-2xl">🎒</span>
          <p
            className="dnd-subheading mt-2"
            style={{ fontStyle: 'italic' }}
          >
            No items yet — create a character to receive starting equipment.
          </p>
        </div>
      </div>
    )
  }

  const sorted = [...items].sort((a, b) => a.item_name.localeCompare(b.item_name))

  return (
    <div className="dnd-card p-6" data-testid="inventory-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="dnd-heading text-lg">⚔ Starting Equipment</h3>
        <span
          className="dnd-badge dnd-badge-lobby"
          data-testid="inventory-count"
        >
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Subtitle */}
      <p
        className="dnd-subheading text-sm mt-1"
        style={{ fontStyle: 'italic' }}
      >
        Your gear for the adventure ahead
      </p>

      {/* Divider */}
      <hr className="dnd-divider" />

      {/* Item list */}
      <ul role="list" className="space-y-2">
        {sorted.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between"
            data-testid="inventory-item"
          >
            <span
              style={{
                fontFamily: "'Lora', Georgia, serif",
                color: 'var(--dnd-parchment)',
              }}
            >
              {item.item_name}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: item.quantity > 1
                  ? 'var(--dnd-gold)'
                  : 'var(--dnd-gold-dim)',
                color: 'var(--dnd-black)',
              }}
            >
              ×{item.quantity}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer note */}
      <p
        className="mt-4 text-xs"
        style={{
          fontStyle: 'italic',
          color: 'var(--dnd-parchment-dim)',
        }}
      >
        Inventory updates after page refresh when class changes
      </p>
    </div>
  )
}
