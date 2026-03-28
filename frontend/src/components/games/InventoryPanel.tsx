'use client'

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

type InventoryPanelProps = {
  items: InventoryItem[]
  hasCharacter: boolean
}

const TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694',
  armor: '\u{1F6E1}',
  focus: '\u2728',
  pack: '\u{1F4E6}',
  ammo: '\u{1F3AF}',
  tool: '\u{1F527}',
  instrument: '\u{1F3B5}',
}

export function InventoryPanel({ items, hasCharacter }: InventoryPanelProps) {
  return (
    <div
      data-testid="inventory-panel"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Starting Inventory
      </h3>

      {!hasCharacter ? (
        <p
          data-testid="inventory-empty-state"
          className="mt-3 text-sm text-gray-400 dark:text-gray-500"
        >
          Create your character above to see your starting items.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
          No items yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((item) => {
            const itemType =
              item.properties &&
              typeof item.properties === 'object' &&
              'type' in item.properties
                ? (item.properties.type as string)
                : null
            const icon = itemType ? TYPE_ICONS[itemType] ?? '' : ''

            return (
              <li
                key={item.id}
                data-testid={`inventory-item-${item.item_name.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm">
                  {icon && <span className="mr-1.5">{icon}</span>}
                  {item.item_name}
                </span>
                <span className="text-sm font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  x{item.quantity}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {hasCharacter && items.length > 0 && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Items are auto-assigned for your class. They reset if you change your
          class.
        </p>
      )}
    </div>
  )
}
