'use client'

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

function getItemTypeIcon(properties: Record<string, unknown> | null): string {
  if (!properties?.type) return ''
  switch (properties.type) {
    case 'weapon':
      return '\u2694\uFE0F'
    case 'armor':
      return '\uD83D\uDEE1\uFE0F'
    case 'pack':
      return '\uD83C\uDF92'
    case 'focus':
      return '\u2728'
    case 'ammunition':
      return '\u27B3'
    case 'tool':
      return '\uD83D\uDD27'
    case 'instrument':
      return '\uD83C\uDFB5'
    default:
      return ''
  }
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  if (!hasCharacter) {
    return (
      <div
        data-testid="inventory-empty-state"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Starting Inventory
        </h3>
        <p className="mt-3 text-sm text-gray-400">
          Create your character above to see your starting items.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="inventory-panel"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Starting Inventory
      </h3>
      <ul className="mt-3 divide-y divide-gray-100">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between py-2 text-sm"
          >
            <span className="text-gray-900">
              {getItemTypeIcon(item.properties)}{' '}
              {item.item_name}
            </span>
            <span className="font-medium text-gray-500">
              x{item.quantity}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-400">
        Items are auto-assigned for your class. They reset if you change your
        class.
      </p>
    </div>
  )
}
