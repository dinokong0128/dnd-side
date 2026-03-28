import { ITEM_TYPE_ICONS } from '@/lib/game-data'

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown>
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  return (
    <div className="dnd-card">
      <h3 className="dnd-label" style={{ marginBottom: '0.75rem' }}>
        Starting Inventory
        {items.length > 0 && (
          <span
            className="ml-2 text-xs"
            style={{
              color: 'var(--dnd-text-muted)',
              textTransform: 'none',
              letterSpacing: 'normal',
            }}
          >
            ({items.length} items)
          </span>
        )}
      </h3>

      {!hasCharacter ? (
        <p
          className="text-sm italic"
          style={{ color: 'var(--dnd-text-muted)' }}
        >
          Create your character above to see your starting items.
        </p>
      ) : items.length === 0 ? (
        <p
          className="text-sm italic"
          style={{ color: 'var(--dnd-text-muted)' }}
        >
          No items yet.
        </p>
      ) : (
        <>
          <div>
            {items.map((item) => {
              const itemType = (item.properties?.type as string) || 'pack'
              const icon = ITEM_TYPE_ICONS[itemType] || '\uD83D\uDCE6'
              return (
                <div
                  key={item.id}
                  className="dnd-inventory-row"
                  data-testid={`inventory-item-${item.item_name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span className="dnd-type-icon">{icon}</span>
                  <span
                    className="flex-1"
                    style={{ color: 'var(--dnd-text)' }}
                  >
                    {item.item_name}
                  </span>
                  <span
                    className="text-sm tabular-nums"
                    style={{ color: 'var(--dnd-text-dim)' }}
                  >
                    \u00D7{item.quantity}
                  </span>
                </div>
              )
            })}
          </div>
          <p
            className="text-xs mt-3 italic"
            style={{ color: 'var(--dnd-text-muted)' }}
          >
            Items are auto-assigned for your class. They reset if you change
            your class.
          </p>
        </>
      )}
    </div>
  )
}
