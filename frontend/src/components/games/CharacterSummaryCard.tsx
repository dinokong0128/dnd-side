'use client'

import { ABILITY_SCORES, type AbilityScore, type CharacterClass } from '@/lib/constants/starting-inventory'

type Props = {
  characterName: string
  characterClass: CharacterClass
  stats: Record<AbilityScore, number>
  hpMax: number
  onEdit: () => void
}

const CLASS_ICONS: Record<CharacterClass, string> = {
  Fighter: '\u2694\uFE0F',
  Wizard: '\uD83E\uDDD9',
  Rogue: '\uD83D\uDDE1\uFE0F',
  Cleric: '\u271D\uFE0F',
  Ranger: '\uD83C\uDFF9',
  Barbarian: '\uD83E\uDE93',
  Paladin: '\uD83D\uDEE1\uFE0F',
  Druid: '\uD83C\uDF3F',
  Bard: '\uD83C\uDFB5',
  Monk: '\uD83E\uDD4B',
  Sorcerer: '\u2728',
  Warlock: '\uD83D\uDD2E',
}

function modifierString(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function CharacterSummaryCard({
  characterName,
  characterClass,
  stats,
  hpMax,
  onEdit,
}: Props) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-amber-800/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg text-emerald-400">&#10003;</span>
          <h2
            className="text-sm font-bold tracking-widest text-emerald-400/80 uppercase"
          >
            Character Ready
          </h2>
        </div>
      </div>

      {/* Identity */}
      <div className="text-center">
        <h3 className="text-2xl font-bold tracking-wide text-amber-50">
          {characterName}
        </h3>
        <p className="mt-1 text-sm text-amber-300/60">
          <span className="mr-1">{CLASS_ICONS[characterClass]}</span>
          {characterClass}
          <span className="mx-2 text-amber-900/60">|</span>
          <span className="text-emerald-400">HP {hpMax}</span>
        </p>
      </div>

      {/* Stat Block */}
      <div className="rounded border border-amber-900/30 bg-stone-900/40 p-4">
        <div className="grid grid-cols-3 gap-3">
          {ABILITY_SCORES.map((ability) => (
            <div
              key={ability}
              className="flex flex-col items-center rounded border border-amber-900/20 bg-stone-950/50 py-2"
            >
              <span className="text-[10px] font-bold tracking-widest text-amber-300/40">
                {ability}
              </span>
              <span className="text-xl font-bold text-amber-50">
                {stats[ability]}
              </span>
              <span className="text-xs text-amber-400/50">
                {modifierString(stats[ability])}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Button */}
      <button
        type="button"
        data-testid="edit-character-button"
        onClick={onEdit}
        className="w-full rounded border border-amber-700/40 px-4 py-2.5 text-sm font-semibold text-amber-300/70 transition-colors hover:border-amber-500/50 hover:text-amber-200"
        style={{ fontVariant: 'small-caps' }}
      >
        Edit Character
      </button>
    </div>
  )
}
