'use client'

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, string>
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

const TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694\uFE0F',
  armor: '\uD83D\uDEE1\uFE0F',
  focus: '\uD83D\uDD2E',
  pack: '\uD83C\uDF92',
  tool: '\uD83D\uDD27',
  ammo: '\u27B3',
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  return (
    <div className="space-y-4">
      <div className="border-b border-amber-800/30 pb-3">
        <h2
          className="text-sm font-bold tracking-widest text-amber-200/60 uppercase"
        >
          Starting Inventory
        </h2>
      </div>

      {!hasCharacter ? (
        <p className="py-4 text-center text-sm text-amber-100/30 italic">
          Create your character above to see your starting items.
        </p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-amber-100/30 italic">
          Loading inventory...
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded border border-amber-900/20 bg-stone-900/40 px-3 py-2 transition-colors hover:border-amber-800/30"
              >
                <span className="flex items-center gap-2 text-sm text-amber-50">
                  <span className="w-5 text-center text-xs">
                    {TYPE_ICONS[item.properties?.type] ?? '\u25C6'}
                  </span>
                  {item.item_name}
                </span>
                <span className="text-xs font-medium text-amber-300/50">
                  x{item.quantity}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-100/25 italic">
            Items are auto-assigned for your class. They reset if you change your class.
          </p>
        </>
      )}
    </div>
  )
}
