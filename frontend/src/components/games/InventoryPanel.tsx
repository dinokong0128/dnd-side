'use client'

const ITEM_TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694',
  armor: '\u{1F6E1}',
  ammo: '\u{1F3AF}',
  arcane: '\u2728',
  pack: '\u{1F4E6}',
  tool: '\u{1F527}',
}

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

type Props = {
  items: InventoryItem[]
  characterClass: string | null
}

export function InventoryPanel({ items, characterClass }: Props) {
  if (!characterClass) {
    return (
      <div
        data-testid="inventory-panel-empty"
        className="rounded-lg p-5 text-center"
        style={{
          background: 'rgba(25,21,15,0.5)',
          border: '1px solid #2d2518',
        }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-[0.15em]"
          style={{ color: '#6a5a3a' }}
        >
          Starting Inventory
        </p>
        <p className="mt-3 text-sm" style={{ color: '#5a4a30' }}>
          Create your character above to see your starting items.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="inventory-panel"
      className="overflow-hidden rounded-lg"
      style={{
        background:
          'linear-gradient(165deg, #1c1710 0%, #231d14 50%, #19150f 100%)',
        border: '1px solid #3d3425',
        boxShadow:
          '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,168,67,0.06)',
      }}
    >
      {/* Decorative top bar */}
      <div
        style={{
          height: '3px',
          background:
            'linear-gradient(90deg, transparent, #8b6914 20%, #d4a843 50%, #8b6914 80%, transparent)',
        }}
      />

      <div className="px-5 pt-4 pb-5">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: '#6a5a3a' }}
        >
          Starting Inventory
        </p>

        <div className="mt-3 space-y-1">
          {items.map((item) => {
            const itemType =
              (item.properties?.type as string | undefined) ?? ''
            const icon = ITEM_TYPE_ICONS[itemType] ?? ''
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md px-3 py-2 transition-colors"
                style={{ background: 'rgba(10,8,5,0.3)' }}
              >
                <div className="flex items-center gap-2.5">
                  {icon && (
                    <span className="text-sm" style={{ opacity: 0.7 }}>
                      {icon}
                    </span>
                  )}
                  <span
                    className="text-sm font-medium"
                    style={{ color: '#e8dcc8' }}
                  >
                    {item.item_name}
                  </span>
                </div>
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: '#7a6a45' }}
                >
                  x{item.quantity}
                </span>
              </div>
            )
          })}
        </div>

        <p
          className="mt-3 text-[11px]"
          style={{ color: '#4a3a25' }}
        >
          Items are auto-assigned for your class. They reset if you change your
          class.
        </p>
      </div>
    </div>
  )
}
