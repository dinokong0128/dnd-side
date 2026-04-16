'use client'

import { useState } from 'react'
import type { PlayerRow } from '@/lib/types/player'
import { DiceRoller } from '@/components/dice/DiceRoller'
import type { DieType } from '@/components/dice/DiceRoller'

export interface LevelUpPayload {
  character_id: string
  new_level: number
}

interface LevelUpModalProps {
  gameId: string
  payload: LevelUpPayload
  player: PlayerRow
  onClose: () => void
  onConfirmed: () => void
}

// Frontend D&D 5e constants (mirror of backend utils/dnd.py)
const HIT_DIE_BY_CLASS: Record<string, DieType> = {
  sorcerer: 'd6', wizard: 'd6',
  bard: 'd8', cleric: 'd8', druid: 'd8', monk: 'd8', rogue: 'd8', warlock: 'd8',
  fighter: 'd10', paladin: 'd10', ranger: 'd10',
  barbarian: 'd12',
}

const SPELL_SLOTS_BY_CLASS_LEVEL: Record<string, Record<number, Record<number, number>>> = {
  wizard:   { 1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2} },
  cleric:   { 1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2} },
  druid:    { 1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2} },
  sorcerer: { 1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2} },
  bard:     { 1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2} },
  paladin:  { 1: {}, 2: {1: 2}, 3: {1: 3}, 4: {1: 3}, 5: {1: 4, 2: 2} },
  ranger:   { 1: {}, 2: {1: 2}, 3: {1: 3}, 4: {1: 3}, 5: {1: 4, 2: 2} },
  warlock:  { 1: {1: 1}, 2: {1: 2}, 3: {2: 2}, 4: {2: 2}, 5: {3: 2} },
}

const CLASS_FEATURES_BY_LEVEL: Record<string, Record<number, string>> = {
  barbarian: { 2: 'Reckless Attack, Danger Sense', 3: 'Primal Path feature', 4: 'Ability Score Improvement', 5: 'Extra Attack, Fast Movement' },
  bard:      { 2: 'Jack of All Trades, Song of Rest', 3: 'Bard College feature, Expertise', 4: 'Ability Score Improvement', 5: 'Bardic Inspiration (d8), Font of Inspiration' },
  cleric:    { 2: 'Channel Divinity, Divine Domain feature', 3: 'Divine Domain feature', 4: 'Ability Score Improvement', 5: 'Destroy Undead (CR 1/2)' },
  druid:     { 2: 'Wild Shape, Druid Circle feature', 3: 'Druid Circle feature', 4: 'Wild Shape improvement, Ability Score Improvement', 5: 'Wild Shape (CR 1)' },
  fighter:   { 2: 'Action Surge, Fighting Style', 3: 'Martial Archetype feature', 4: 'Ability Score Improvement', 5: 'Extra Attack' },
  monk:      { 2: 'Ki, Unarmored Movement', 3: 'Monastic Tradition feature, Deflect Missiles', 4: 'Slow Fall, Ability Score Improvement', 5: 'Extra Attack, Stunning Strike' },
  paladin:   { 2: 'Divine Smite, Fighting Style, Spellcasting', 3: 'Sacred Oath feature, Divine Health', 4: 'Ability Score Improvement', 5: 'Extra Attack' },
  ranger:    { 2: 'Fighting Style, Spellcasting, Primeval Awareness', 3: 'Ranger Archetype feature', 4: 'Ability Score Improvement', 5: 'Extra Attack' },
  rogue:     { 2: 'Cunning Action', 3: 'Roguish Archetype feature, Sneak Attack (2d6)', 4: 'Ability Score Improvement', 5: 'Uncanny Dodge, Sneak Attack (3d6)' },
  sorcerer:  { 2: 'Font of Magic', 3: 'Sorcerous Origin feature, Metamagic', 4: 'Ability Score Improvement', 5: 'Sorcerous Origin feature' },
  warlock:   { 2: 'Eldritch Invocations', 3: 'Pact Boon', 4: 'Ability Score Improvement', 5: 'Eldritch Invocations improvement' },
  wizard:    { 2: 'Arcane Tradition feature', 3: 'Arcane Tradition feature', 4: 'Ability Score Improvement', 5: 'Arcane Tradition feature' },
}

const PROFICIENCY_BY_LEVEL: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3,
}

const SLOT_ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }

export function LevelUpModal({ gameId, payload, player, onClose, onConfirmed }: LevelUpModalProps) {
  const [hpChoice, setHpChoice] = useState<'roll' | 'average' | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rollKey, setRollKey] = useState(0)

  const { new_level, character_id } = payload
  const charClass = player.character_class.toLowerCase()
  const hitDie = HIT_DIE_BY_CLASS[charClass] ?? 'd8'
  const dieSides = parseInt(hitDie.slice(1))
  const conMod = Math.floor((player.stats.con - 10) / 2)
  const avgHp = Math.ceil(dieSides / 2) + conMod
  const oldProf = PROFICIENCY_BY_LEVEL[new_level - 1] ?? 2
  const newProf = PROFICIENCY_BY_LEVEL[new_level] ?? 2

  // Spell slot diff
  const classSlots = SPELL_SLOTS_BY_CLASS_LEVEL[charClass]
  const isSpellcaster = classSlots !== undefined
  const oldSlots = player.stats.spell_slots ?? {}
  const newLevelSlots: Record<number, number> = classSlots?.[Math.min(new_level, 5)] ?? {}

  // Class features
  const classFeatures = CLASS_FEATURES_BY_LEVEL[charClass]?.[new_level]

  const handleConfirm = async () => {
    if (!hpChoice) return
    setIsLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/games/${gameId}/level-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id, hp_choice: hpChoice }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        setError(data.detail ?? 'Something went wrong')
        return
      }
      onConfirmed()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const cardBase: React.CSSProperties = {
    flex: 1,
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: '6px',
    padding: '12px',
    cursor: 'pointer',
    background: 'rgba(201,168,76,0.04)',
    transition: 'border-color 0.15s, background 0.15s',
  }

  const cardSelected: React.CSSProperties = {
    ...cardBase,
    borderColor: 'rgba(201,168,76,0.6)',
    background: 'rgba(201,168,76,0.1)',
  }

  return (
    <div
      role="dialog"
      aria-label="Level Up"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--dnd-charcoal, #1c1c1e)',
          border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header */}
        <div>
          <h2
            style={{
              fontFamily: "'Cinzel', serif",
              color: 'var(--dnd-gold, #c9a84c)',
              fontSize: '1.2rem',
              margin: 0,
            }}
          >
            You&apos;ve reached Level {new_level}!
          </h2>
          <p
            style={{
              fontFamily: "'Lora', serif",
              fontStyle: 'italic',
              fontSize: '0.85rem',
              color: 'var(--dnd-parchment-dim, #8a7a60)',
              margin: '4px 0 0 0',
            }}
          >
            {player.character_name} — {player.character_class}
          </p>
        </div>

        {/* Stat diff cards */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, background: 'rgba(201,168,76,0.06)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dnd-parchment-dim, #8a7a60)', marginBottom: '4px' }}>Level</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', color: 'var(--dnd-parchment, #f0e6c8)' }}>
              {new_level - 1} → {new_level}
            </div>
          </div>
          <div style={{ flex: 1, background: 'rgba(201,168,76,0.06)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dnd-parchment-dim, #8a7a60)', marginBottom: '4px' }}>Proficiency</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', color: 'var(--dnd-parchment, #f0e6c8)' }}>
              +{oldProf} → +{newProf}
            </div>
            <div style={{ fontSize: '0.6rem', color: newProf > oldProf ? '#6fcf97' : 'var(--dnd-parchment-dim, #8a7a60)', fontFamily: "'Cinzel', serif" }}>
              {newProf > oldProf ? 'Increased' : 'Unchanged'}
            </div>
          </div>
        </div>

        {/* HP increase */}
        <div>
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dnd-parchment-dim, #8a7a60)', margin: '0 0 8px 0' }}>
            HP Increase
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Roll card */}
            <div
              data-testid="hp-choice-roll"
              onClick={() => setHpChoice('roll')}
              style={hpChoice === 'roll' ? cardSelected : cardBase}
            >
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--dnd-gold, #c9a84c)', marginBottom: '8px' }}>
                Roll
              </div>
              {hpChoice === 'roll' && (
                <DiceRoller
                  key={rollKey}
                  dieType={hitDie}
                  autoRoll
                  label={`${hitDie} HP Roll`}
                  onAnimationComplete={() => {}}
                />
              )}
              {conMod !== 0 && (
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.7rem', color: 'var(--dnd-parchment-dim, #8a7a60)', marginTop: '6px' }}>
                  {conMod > 0 ? '+' : ''}{conMod} CON
                </div>
              )}
              {hpChoice === 'roll' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setRollKey((k) => k + 1) }}
                  style={{ marginTop: '8px', background: 'none', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '4px', color: 'var(--dnd-gold, #c9a84c)', fontSize: '0.6rem', cursor: 'pointer', padding: '2px 8px', fontFamily: "'Cinzel', serif" }}
                >
                  Re-roll
                </button>
              )}
            </div>

            {/* Average card */}
            <div
              data-testid="hp-choice-average"
              onClick={() => setHpChoice('average')}
              style={hpChoice === 'average' ? cardSelected : cardBase}
            >
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--dnd-gold, #c9a84c)', marginBottom: '8px' }}>
                Take Average
              </div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.2rem', color: 'var(--dnd-parchment, #f0e6c8)', textAlign: 'center' }}>
                +{Math.max(1, avgHp)}
              </div>
              <div style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: '0.65rem', color: 'var(--dnd-parchment-dim, #8a7a60)', marginTop: '4px' }}>
                ⌈{hitDie.slice(1)}/2⌉{conMod !== 0 ? ` ${conMod > 0 ? '+' : ''}${conMod}` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Spell slot diff (spellcasters only) */}
        {isSpellcaster && Object.keys(newLevelSlots).length > 0 && (
          <div data-testid="spell-slot-diff">
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dnd-parchment-dim, #8a7a60)', margin: '0 0 8px 0' }}>
              Spell Slots
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(newLevelSlots).map(([slotLvl, newCount]) => {
                const lvlInt = parseInt(slotLvl)
                const oldCount = oldSlots[slotLvl]?.max ?? 0
                if (newCount === oldCount) return null
                return (
                  <div
                    key={slotLvl}
                    style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', color: 'var(--dnd-parchment, #f0e6c8)', display: 'flex', gap: '8px' }}
                  >
                    <span style={{ color: 'var(--dnd-parchment-dim, #8a7a60)', minWidth: '60px' }}>
                      {SLOT_ORDINALS[lvlInt] ?? `${lvlInt}th`} level:
                    </span>
                    <span>
                      {oldCount === 0 ? (
                        <span style={{ color: '#6fcf97' }}>+{newCount} (new)</span>
                      ) : (
                        <span>{oldCount} → <span style={{ color: '#6fcf97' }}>{newCount}</span></span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Class features */}
        {classFeatures && (
          <div>
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dnd-parchment-dim, #8a7a60)', margin: '0 0 6px 0' }}>
              Class Features Unlocked
            </p>
            <p style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--dnd-parchment, #f0e6c8)', margin: 0 }}>
              {classFeatures}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            data-testid="level-up-error"
            style={{
              fontFamily: "'Lora', serif",
              fontSize: '0.8rem',
              color: '#e8a0a0',
              background: 'rgba(139,34,50,0.12)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '4px',
              padding: '8px 12px',
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            className="dnd-btn-secondary"
            style={{ padding: '6px 16px', fontSize: '0.7rem' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hpChoice || isLoading}
            className="dnd-btn"
            style={{ padding: '6px 16px', fontSize: '0.7rem' }}
          >
            {isLoading ? 'Levelling up...' : 'Confirm Level Up'}
          </button>
        </div>
      </div>
    </div>
  )
}
