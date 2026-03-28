'use client'

import type { InventoryItem } from '@/lib/supabase/players'

const TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694',
  armor: '\u{1F6E1}',
  focus: '\u2728',
  pack: '\u{1F392}',
  tool: '\u{1F527}',
  ammunition: '\u{1F3AF}',
  instrument: '\u{1F3B5}',
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  if (!hasCharacter) {
    return (
      <div
        data-testid="inventory-empty-state"
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5"
      >
        <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Starting Inventory
        </h3>
        <p className="mt-3 text-sm text-zinc-500">
          Create your character above to see your starting items.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="inventory-panel"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5"
    >
      <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
        Starting Inventory
      </h3>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No items yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((item) => {
            const itemType =
              item.properties && typeof item.properties === 'object'
                ? (item.properties as Record<string, unknown>).type
                : null
            const icon =
              typeof itemType === 'string' ? TYPE_ICONS[itemType] ?? '' : ''
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/50"
              >
                <span className="flex items-center gap-2 text-zinc-300">
                  {icon && <span className="text-base">{icon}</span>}
                  {item.item_name}
                </span>
                <span className="tabular-nums text-zinc-500">
                  x{item.quantity}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-zinc-600">
        Items are auto-assigned for your class. They reset if you change your class.
      </p>
    </div>
  )
}
