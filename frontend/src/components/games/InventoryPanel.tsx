'use client'

import { ITEM_TYPE_ICONS, type ItemType } from '@/lib/game-data'
import type { InventoryItem } from '@/lib/supabase/players'

type Props = {
  inventory: InventoryItem[]
  hasCharacter: boolean
}

function getItemTypeClass(type: string): string {
  const typeMap: Record<string, string> = {
    weapon: 'dnd-item-icon-weapon',
    armor: 'dnd-item-icon-armor',
    pack: 'dnd-item-icon-pack',
    focus: 'dnd-item-icon-focus',
    tool: 'dnd-item-icon-tool',
    ammunition: 'dnd-item-icon-ammo',
    instrument: 'dnd-item-icon-instrument',
  }
  return typeMap[type] || 'dnd-item-icon-pack'
}

export function InventoryPanel({ inventory, hasCharacter }: Props) {
  return (
    <div className="dnd-card" data-testid="inventory-panel">
      <div className="dnd-card-body">
        <div className="dnd-inventory-heading">
          <span>Starting Inventory</span>
          {inventory.length > 0 && (
            <span className="dnd-item-count-badge">
              {inventory.length} {inventory.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {!hasCharacter ? (
          <p className="dnd-inventory-empty" data-testid="inventory-empty">
            Save your character above to see your starting equipment.
          </p>
        ) : inventory.length === 0 ? (
          <p className="dnd-inventory-empty">No items yet.</p>
        ) : (
          <>
            <div className="dnd-inventory-list">
              {inventory.map((item) => {
                const itemType = (item.properties?.type ?? 'pack') as ItemType
                const icon = ITEM_TYPE_ICONS[itemType] ?? ITEM_TYPE_ICONS.pack
                return (
                  <div
                    key={item.id}
                    className="dnd-inventory-item"
                    data-testid={`inventory-item-${item.item_name}`}
                  >
                    <div className={`dnd-item-icon ${getItemTypeClass(itemType)}`}>
                      {icon}
                    </div>
                    <div className="dnd-item-name">{item.item_name}</div>
                    <div className="dnd-item-qty">&times;{item.quantity}</div>
                  </div>
                )
              })}
            </div>
            <p className="dnd-inventory-footer">
              Items are auto-assigned for your class. They reset if you change
              your class.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
