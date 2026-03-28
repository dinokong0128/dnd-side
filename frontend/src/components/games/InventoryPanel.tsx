'use client'

import { getItemTypeIcon } from '@/lib/constants/starting-inventory'
import type { InventoryItem } from '@/lib/supabase/players'

type InventoryPanelProps = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: InventoryPanelProps) {
  return (
    <div className="dnd-card px-6 py-6" data-testid="inventory-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="dnd-heading text-base font-semibold">
          Starting Inventory
        </h3>
        {items.length > 0 && (
          <span
            className="text-xs"
            style={{
              color: 'var(--dnd-parchment-dim)',
              fontFamily: "'Cinzel', serif",
              letterSpacing: '0.05em',
            }}
          >
            {items.length} items
          </span>
        )}
      </div>

      {!hasCharacter ? (
        <p
          className="text-sm"
          style={{ color: 'var(--muted)', fontStyle: 'italic' }}
          data-testid="inventory-empty"
        >
          Create your character above to see your starting items.
        </p>
      ) : items.length === 0 ? (
        <p
          className="text-sm"
          style={{ color: 'var(--muted)', fontStyle: 'italic' }}
          data-testid="inventory-loading"
        >
          Loading inventory...
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item) => {
              const itemType =
                (item.properties as Record<string, string> | null)?.type ?? ''
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1"
                  style={{ borderBottom: '1px solid var(--card-border)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm"
                      style={{ width: '1.5rem', textAlign: 'center' }}
                      title={itemType}
                    >
                      {getItemTypeIcon(itemType)}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--dnd-parchment)' }}>
                      {item.item_name}
                    </span>
                  </div>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--dnd-parchment-dim)' }}
                  >
                    &times;{item.quantity}
                  </span>
                </div>
              )
            })}
          </div>
          <p
            className="mt-4 text-xs"
            style={{ color: 'var(--dnd-parchment-dim)', fontStyle: 'italic' }}
          >
            Items are auto-assigned for your class. They reset if you change
            your class.
          </p>
        </>
      )}
    </div>
  )
}
