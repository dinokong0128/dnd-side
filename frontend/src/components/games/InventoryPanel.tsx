'use client'

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, string> | null
}

const TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694\uFE0F',
  armor: '\uD83D\uDEE1\uFE0F',
  focus: '\u2728',
  pack: '\uD83C\uDF92',
  tool: '\uD83D\uDD27',
  ammunition: '\u27B3',
  instrument: '\uD83C\uDFB5',
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  if (!hasCharacter) {
    return (
      <div data-testid="inventory-empty-state" className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-500/60">
          Starting Inventory
        </h3>
        <p className="text-sm text-amber-700/60">
          Create your character above to see your starting items.
        </p>
      </div>
    )
  }

  return (
    <div data-testid="inventory-panel" className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-500/60">
        Starting Inventory
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-amber-700/60">No items yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const itemType = item.properties?.type ?? ''
            const icon = TYPE_ICONS[itemType] ?? ''
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-amber-950/30"
              >
                <span className="text-amber-200">
                  {icon && <span className="mr-1.5">{icon}</span>}
                  {item.item_name}
                </span>
                <span className="font-mono text-xs text-amber-500/60">
                  x{item.quantity}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-amber-800/50">
        Items are auto-assigned for your class. They reset if you change your class.
      </p>
    </div>
  )
}
