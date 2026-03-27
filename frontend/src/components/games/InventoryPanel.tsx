'use client'

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

const TYPE_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  weapon: { label: 'Weapon', color: '#d06060', bg: 'rgba(180,40,40,0.1)', border: 'rgba(180,60,60,0.25)' },
  armor: { label: 'Armor', color: '#6090c0', bg: 'rgba(60,100,160,0.1)', border: 'rgba(60,100,160,0.25)' },
  ammunition: { label: 'Ammo', color: '#a08050', bg: 'rgba(160,128,80,0.1)', border: 'rgba(160,128,80,0.25)' },
  pack: { label: 'Pack', color: '#7a9060', bg: 'rgba(100,140,60,0.1)', border: 'rgba(100,140,60,0.25)' },
  focus: { label: 'Focus', color: '#9070b0', bg: 'rgba(130,90,170,0.1)', border: 'rgba(130,90,170,0.25)' },
  tool: { label: 'Tool', color: '#a09070', bg: 'rgba(160,144,112,0.1)', border: 'rgba(160,144,112,0.25)' },
  instrument: { label: 'Instrument', color: '#c09050', bg: 'rgba(192,144,80,0.1)', border: 'rgba(192,144,80,0.25)' },
}

export function InventoryPanel({
  items,
  hasCharacter,
}: {
  items: InventoryItem[]
  hasCharacter: boolean
}) {
  if (!hasCharacter) {
    return (
      <div
        data-testid="inventory-empty-state"
        className="relative overflow-hidden rounded-lg"
        style={{
          background: 'linear-gradient(165deg, #1c1710 0%, #231d14 50%, #19150f 100%)',
          border: '1px solid #2d2518',
        }}
      >
        <div className="p-5">
          <h3
            className="mb-2 text-xs font-bold uppercase tracking-[0.15em]"
            style={{ color: '#6a5a3a' }}
          >
            Starting Inventory
          </h3>
          <p className="text-sm italic" style={{ color: '#4a4030' }}>
            Create your character above to see your starting items.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="inventory-panel"
      className="relative overflow-hidden rounded-lg"
      style={{
        background: 'linear-gradient(165deg, #1c1710 0%, #231d14 50%, #19150f 100%)',
        border: '1px solid #3d3425',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,168,67,0.06)',
      }}
    >
      {/* Decorative top bar */}
      <div
        style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #5a4520 30%, #8b6914 50%, #5a4520 70%, transparent)',
        }}
      />

      <div className="p-5">
        <h3
          className="mb-3 text-xs font-bold uppercase tracking-[0.15em]"
          style={{ color: '#9a8a60' }}
        >
          Starting Inventory
        </h3>

        {items.length === 0 ? (
          <p className="text-sm italic" style={{ color: '#4a4030' }}>
            No items yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const itemType =
                item.properties && typeof item.properties.type === 'string'
                  ? item.properties.type
                  : null
              const style = itemType ? TYPE_STYLES[itemType] : null

              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 transition-colors"
                  style={{
                    background: 'rgba(10,8,5,0.3)',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(180,130,50,0.04)'
                    e.currentTarget.style.borderColor = '#2d2518'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(10,8,5,0.3)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: '#e8dcc8' }}>
                      {item.item_name}
                    </span>
                    {style && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          color: style.color,
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        {style.label}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: '#6a5a3a' }}
                  >
                    x{item.quantity}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-3 text-[11px]" style={{ color: '#4a4030' }}>
          Items are auto-assigned for your class. They reset if you change your class.
        </p>
      </div>
    </div>
  )
}
