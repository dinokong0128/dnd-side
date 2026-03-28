'use client'

import type { InventoryItem } from '@/lib/supabase/players'
import type { ItemType } from '@/lib/game-data/characters'

const ITEM_TYPE_ICONS: Record<ItemType, string> = {
  weapon: '\u2694',
  armor: '\uD83D\uDEE1',
  pack: '\uD83C\uDF92',
  focus: '\u2728',
  tool: '\uD83D\uDD27',
  ammunition: '\u27B3',
  instrument: '\uD83C\uDFB5',
}

const ITEM_TYPE_CLASSES: Record<ItemType, string> = {
  weapon: 'bg-red-900/20 text-red-400',
  armor: 'bg-blue-900/20 text-blue-400',
  pack: 'bg-green-900/20 text-green-400',
  focus: 'bg-purple-900/20 text-purple-400',
  tool: 'bg-yellow-900/20 text-yellow-500',
  ammunition: 'bg-amber-900/20 text-amber-600',
  instrument: 'bg-amber-800/20 text-amber-400',
}

type Props = {
  inventory: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ inventory, hasCharacter }: Props) {
  return (
    <div data-testid="inventory-panel" className="dnd-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="dnd-card-title mb-0">Starting Inventory</h2>
        {inventory.length > 0 && (
          <span className="text-sm text-[var(--dnd-parchment-dim)]">
            {inventory.length} items
          </span>
        )}
      </div>

      {!hasCharacter ? (
        <p data-testid="inventory-empty" className="text-center py-8 text-[var(--dnd-parchment-dim)] italic">
          Create your character above to see your starting items.
        </p>
      ) : inventory.length === 0 ? (
        <p className="text-center py-8 text-[var(--dnd-parchment-dim)] italic">
          Loading inventory...
        </p>
      ) : (
        <>
          <div className="divide-y divide-[var(--dnd-border-subtle)]/50">
            {inventory.map((item) => {
              const itemType = (item.properties?.type as ItemType) ?? 'pack'
              const damage = item.properties?.damage as string | undefined
              return (
                <div key={item.id} className="flex items-center justify-between py-2.5" data-testid={`inv-item-${item.item_name}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 flex items-center justify-center rounded-md text-sm flex-shrink-0 ${ITEM_TYPE_CLASSES[itemType]}`}>
                      {ITEM_TYPE_ICONS[itemType]}
                    </div>
                    <span className="text-[var(--dnd-parchment)]">
                      {item.item_name}
                      {damage && (
                        <span className="ml-2 text-sm text-[var(--dnd-parchment-dim)]">{damage}</span>
                      )}
                    </span>
                  </div>
                  <span className="font-mono text-sm text-[var(--dnd-parchment-dim)] min-w-[2rem] text-right">
                    x{item.quantity}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-sm text-[var(--dnd-parchment-dim)] italic mt-4 pt-3 border-t border-[var(--dnd-border-subtle)]">
            Items are auto-assigned for your class. They reset if you change your class.
          </p>
        </>
      )}
    </div>
  )
}
