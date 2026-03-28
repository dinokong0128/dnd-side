'use client'

type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

const ITEM_TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694\uFE0F',
  armor: '\uD83D\uDEE1\uFE0F',
  focus: '\u2728',
  pack: '\uD83C\uDF92',
  ammo: '\u27B3',
  tool: '\uD83D\uDD27',
  instrument: '\uD83C\uDFB5',
}

type InventoryPanelProps = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: InventoryPanelProps) {
  return (
    <div data-testid="inventory-panel" className="space-y-3">
      <h3 className="font-serif text-lg tracking-wide text-amber-200/90">
        Starting Inventory
      </h3>

      {!hasCharacter ? (
        <p
          data-testid="inventory-empty-state"
          className="py-4 text-center text-sm text-stone-500 italic"
        >
          Create your character above to see your starting items.
        </p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-stone-500 italic">
          No items yet.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-stone-800/60">
            {items.map((item) => {
              const itemType =
                (item.properties as Record<string, string> | null)?.type ?? ''
              const icon = ITEM_TYPE_ICONS[itemType] ?? ''

              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-sm text-stone-300">
                    {icon && (
                      <span className="mr-2 inline-block w-5 text-center">
                        {icon}
                      </span>
                    )}
                    {item.item_name}
                  </span>
                  <span className="tabular-nums text-sm text-stone-500">
                    x{item.quantity}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-stone-600">
            Items are auto-assigned for your class. They reset if you change
            your class.
          </p>
        </>
      )}
    </div>
  )
}
