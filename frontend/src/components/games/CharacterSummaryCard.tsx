'use client'

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

type CharacterData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function CharacterSummaryCard({
  character,
  onEdit,
  editable = true,
}: {
  character: CharacterData
  onEdit?: () => void
  editable?: boolean
}) {
  return (
    <div
      data-testid="character-summary-card"
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
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #8b6914 20%, #d4a843 50%, #8b6914 80%, transparent)',
        }}
      />

      {/* Header */}
      <div className="px-6 pt-5 pb-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#5a8a3a' }}>
              Character Ready
            </p>
            <h3
              className="mt-1 text-xl font-bold"
              style={{ color: '#e8d5a3', fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {character.character_name}
            </h3>
            <p className="mt-0.5 text-sm" style={{ color: '#b09050' }}>
              {character.character_class}
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5"
            style={{
              background: 'linear-gradient(135deg, rgba(180,40,40,0.2), rgba(120,20,20,0.15))',
              border: '1px solid rgba(180,60,60,0.3)',
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a05050' }}>HP</span>
            <span className="text-sm font-bold" style={{ color: '#e07070' }}>
              {character.hp_current}/{character.hp_max}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 my-4" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #3d3425, transparent)' }} />

      {/* Stats Grid */}
      <div className="px-6 pb-5">
        <div className="grid grid-cols-6 gap-2">
          {ABILITY_ORDER.map((stat) => {
            const score = character.stats[stat] ?? 10
            return (
              <div
                key={stat}
                className="rounded-md py-2.5 text-center"
                style={{
                  background: 'rgba(10,8,5,0.4)',
                  border: '1px solid #2d2518',
                }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: '#6a5a3a' }}
                >
                  {ABILITY_LABELS[stat]}
                </div>
                <div
                  className="mt-0.5 text-lg font-bold"
                  style={{ color: '#e8dcc8' }}
                >
                  {score}
                </div>
                <div className="text-[11px] font-medium" style={{ color: '#7a6a45' }}>
                  {getModifier(score)}
                </div>
              </div>
            )
          })}
        </div>

        {editable && onEdit && (
          <button
            onClick={onEdit}
            data-testid="edit-character-button"
            className="mt-4 w-full rounded-md py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all hover:opacity-80"
            style={{
              color: '#b09050',
              background: 'rgba(180,130,50,0.06)',
              border: '1px solid #3d3425',
            }}
          >
            Edit Character
          </button>
        )}
      </div>
    </div>
  )
}
