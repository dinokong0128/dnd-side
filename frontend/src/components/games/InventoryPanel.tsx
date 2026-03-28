'use client'

import type { InventoryItem } from '@/lib/supabase/players'

const TYPE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  weapon: { color: '#c05050', bg: 'rgba(190,60,60,0.12)', label: 'Weapon' },
  armor: { color: '#6088b0', bg: 'rgba(80,120,170,0.12)', label: 'Armor' },
  pack: { color: '#7a9050', bg: 'rgba(110,140,60,0.12)', label: 'Pack' },
  focus: { color: '#9070b0', bg: 'rgba(130,90,170,0.12)', label: 'Focus' },
  ammo: { color: '#a08050', bg: 'rgba(160,120,60,0.12)', label: 'Ammo' },
  tool: { color: '#70a0a0', bg: 'rgba(90,150,150,0.12)', label: 'Tool' },
  instrument: { color: '#b08060', bg: 'rgba(170,110,70,0.12)', label: 'Instrument' },
}

function getItemType(item: InventoryItem): { color: string; bg: string; label: string } {
  const type = (item.properties as Record<string, unknown>)?.type as string | undefined
  return TYPE_STYLES[type ?? ''] ?? { color: '#6a5a3a', bg: 'rgba(100,80,50,0.1)', label: 'Item' }
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  return (
    <div data-testid="inventory-panel">
      <h3
        className="text-[11px] font-bold uppercase tracking-[0.15em]"
        style={{ color: '#8a7a55' }}
      >
        Starting Inventory
      </h3>

      {!hasCharacter ? (
        <p
          className="mt-3 text-sm italic"
          style={{ color: '#5a4f3a' }}
          data-testid="inventory-empty-state"
        >
          Create your character above to see your starting items.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm italic" style={{ color: '#5a4f3a' }}>
          Loading inventory...
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((item) => {
            const typeInfo = getItemType(item)
            const damage = (item.properties as Record<string, unknown>)
              ?.damage as string | undefined
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md px-3 py-2 transition-colors"
                style={{
                  background: 'rgba(10,8,5,0.3)',
                  border: '1px solid rgba(45,37,24,0.5)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      color: typeInfo.color,
                      background: typeInfo.bg,
                    }}
                  >
                    {typeInfo.label}
                  </span>
                  <span className="text-sm" style={{ color: '#d4c8a8' }}>
                    {item.item_name}
                  </span>
                  {damage && (
                    <span
                      className="text-[10px]"
                      style={{ color: '#6a5a3a' }}
                    >
                      {damage}
                    </span>
                  )}
                </div>
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: '#7a6a45' }}
                >
                  x{item.quantity}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {hasCharacter && items.length > 0 && (
        <p
          className="mt-3 text-[11px] italic"
          style={{ color: '#4a4030' }}
        >
          Items are auto-assigned for your class. They reset if you change
          your class.
        </p>
      )}
    </div>
  )
}
