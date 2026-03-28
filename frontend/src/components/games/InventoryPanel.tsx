'use client'

type InventoryItem = {
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

const TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694\uFE0F',
  armor: '\uD83D\uDEE1\uFE0F',
  pack: '\uD83C\uDF92',
  ammunition: '\u27B0',
  spellcasting: '\u2728',
  tool: '\uD83D\uDD27',
  instrument: '\uD83C\uDFB5',
}

type Props = {
  items: InventoryItem[]
  hasCharacter: boolean
}

export function InventoryPanel({ items, hasCharacter }: Props) {
  if (!hasCharacter) {
    return (
      <div className="rounded-lg border border-card-border bg-card-bg p-5">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-muted-text">
          Starting Inventory
        </h3>
        <p className="mt-3 text-sm text-muted-text/70">
          Create your character above to see your starting items.
        </p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-card-border bg-card-bg p-5">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-muted-text">
          Starting Inventory
        </h3>
        <p className="mt-3 text-sm text-muted-text/70">
          No items yet. Your inventory will populate when your character is saved.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-card-border bg-card-bg p-5">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-muted-text">
        Starting Inventory
      </h3>

      <ul className="mt-4 space-y-1">
        {items.map((item) => {
          const itemType = (item.properties?.type as string) ?? ''
          const icon = TYPE_ICONS[itemType] ?? '\u25AA'
          const damage = item.properties?.damage as string | undefined

          return (
            <li
              key={item.item_name}
              className="group flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-input-bg"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">{icon}</span>
                <div>
                  <span className="text-sm text-foreground">{item.item_name}</span>
                  {damage && (
                    <span className="ml-2 text-[10px] text-muted-text/60">{damage}</span>
                  )}
                </div>
              </div>
              <span className="text-xs tabular-nums text-muted-text">
                x{item.quantity}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 border-t border-card-border pt-3 text-[11px] text-muted-text/50">
        Items are auto-assigned for your class. They reset if you change your class.
      </p>
    </div>
  )
}
