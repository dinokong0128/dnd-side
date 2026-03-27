'use client'

import { type InventoryItem } from '@/lib/supabase/players'

const ITEM_TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694\uFE0F',
  armor: '\uD83D\uDEE1\uFE0F',
  focus: '\u2728',
  pack: '\uD83C\uDF92',
  tool: '\uD83D\uDD27',
  ammunition: '\uD83C\uDFF9',
  instrument: '\uD83C\uDFB5',
}

function getItemIcon(properties: Record<string, unknown>): string {
  const type = typeof properties?.type === 'string' ? properties.type : ''
  return ITEM_TYPE_ICONS[type] ?? '\uD83D\uDCE6'
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  return (
    <div
      data-testid="inventory-panel"
      className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
        <h3 className="text-sm font-bold">Starting Inventory</h3>
        {items.length > 0 && (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {items.length} items
          </span>
        )}
      </div>

      {/* Content */}
      {!hasCharacter ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-gray-400">
            Save your character above to see your starting equipment.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No items yet.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 text-base dark:bg-gray-800">
                    {getItemIcon(item.properties)}
                  </span>
                  <span className="text-sm font-medium">{item.item_name}</span>
                </div>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  x{item.quantity}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200 px-5 py-2.5 text-xs italic text-gray-400 dark:border-gray-700">
            Items are auto-assigned for your class. They reset if you change your class.
          </div>
        </>
      )}
    </div>
  )
}
