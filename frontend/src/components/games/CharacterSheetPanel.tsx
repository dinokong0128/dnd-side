'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PlayerRow } from '@/lib/types/player'
import { STAT_NAMES } from '@/lib/constants/game'
import { formatModifier, getModifier } from '@/lib/utils/dnd'

interface InventoryItem {
  id: string
  player_id: string
  item_name: string
  quantity: number
}

interface CharacterSheetPanelProps {
  playerId: string
  onClose: () => void
}

function getHpState(current: number, max: number): 'high' | 'medium' | 'low' {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'high'
  if (pct >= 0.25) return 'medium'
  return 'low'
}

const HP_COLORS: Record<'high' | 'medium' | 'low', string> = {
  high: '#2d6a4f',   // --dnd-emerald
  medium: '#c68b2a', // --dnd-amber
  low: '#c0392b',    // --dnd-crimson-bright
}

export function CharacterSheetPanel({ playerId, onClose }: CharacterSheetPanelProps) {
  const [player, setPlayer] = useState<PlayerRow | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const supabase = createClient()

    const init = async () => {
      // Authenticate Realtime with JWT (same pattern as GameSessionView)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      // Fetch player row
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()

      if (playerError || !playerData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setPlayer(playerData as PlayerRow)

      // Fetch inventory
      const { data: invData } = await supabase
        .from('player_inventory')
        .select('*')
        .eq('player_id', playerId)

      setInventory((invData ?? []) as InventoryItem[])
      setLoading(false)
    }

    init()

    // Realtime: subscribe to players UPDATE for this player's HP changes
    const playersSub = supabase
      .channel(`players:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${playerId}`,
        },
        (payload) => {
          setPlayer(payload.new as PlayerRow)
        }
      )
      .subscribe()

    return () => {
      playersSub?.unsubscribe()
    }
  }, [playerId])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // E2E testing: listen for player stat updates dispatched by tests
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_TESTING !== 'true') return
    const handlePlayerUpdate = (e: Event) => {
      const updated = (e as CustomEvent<Partial<PlayerRow>>).detail
      setPlayer((prev) => (prev ? { ...prev, ...updated } : prev))
    }
    const eventName = `e2e-player-update-${playerId}`
    window.addEventListener(eventName, handlePlayerUpdate)
    // Marker so Playwright can wait for listener attach before dispatching.
    // Defer via setTimeout so that in React Strict Mode (Next.js dev default)
    // the marker only appears after the mount → cleanup → mount cycle settles,
    // never in the synchronous gap where the first listener is about to be
    // removed.
    const markerTimer = setTimeout(() => {
      document.body.dataset.e2ePlayerListenerReady = playerId
    }, 0)
    return () => {
      clearTimeout(markerTimer)
      window.removeEventListener(eventName, handlePlayerUpdate)
      if (document.body.dataset.e2ePlayerListenerReady === playerId) {
        delete document.body.dataset.e2ePlayerListenerReady
      }
    }
  }, [playerId])

  // Sorted inventory alphabetically
  const sortedInventory = [...inventory].sort((a, b) =>
    a.item_name.localeCompare(b.item_name)
  )

  const hpState = player ? getHpState(player.hp_current, player.hp_max) : 'high'
  const hpPct = player && player.hp_max > 0 ? (player.hp_current / player.hp_max) * 100 : 0
  const hpColor = HP_COLORS[hpState]

  return (
    <div
      role="dialog"
      aria-label="Character Sheet"
      style={{
        width: collapsed ? '68px' : '300px',
        transition: 'width 0.3s ease',
        flexShrink: 0,
        background: 'var(--dnd-charcoal, #1a1a1a)',
        borderLeft: '1px solid var(--dnd-brown, #3d2e1e)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '1px solid var(--dnd-brown, #3d2e1e)',
          flexShrink: 0,
        }}
      >
        <button
          data-testid="character-sheet-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand character sheet' : 'Collapse character sheet'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--dnd-parchment-dim, #8a7a60)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            padding: '2px 4px',
          }}
        >
          {collapsed ? '›' : '‹'}
        </button>
        {!collapsed && (
          <button
            data-testid="character-sheet-close"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close character sheet"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--dnd-parchment-dim, #8a7a60)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '2px 4px',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div
          data-testid="character-sheet-skeleton"
          style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '20px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.08)',
                animation: 'shimmer 1.2s ease-in-out infinite',
                backgroundSize: '200%',
              }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && notFound && (
        <div
          data-testid="character-sheet-empty"
          style={{
            padding: '16px',
            textAlign: 'center',
            fontFamily: "'Lora', serif",
            fontSize: '0.85rem',
            fontStyle: 'italic',
            color: 'var(--dnd-parchment-dim, #8a7a60)',
          }}
        >
          No character created yet.
        </div>
      )}

      {/* Content */}
      {!loading && !notFound && player && (
        <>
          {collapsed ? (
            /* Collapsed strip */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 4px',
                gap: '4px',
                flex: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: '0.5rem',
                  color: 'var(--dnd-parchment-dim, #8a7a60)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                HP
              </span>

              {/* Vertical HP bar */}
              <div
                style={{
                  flex: 1,
                  minHeight: '80px',
                  width: '20px',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '3px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  data-testid="hp-bar"
                  data-hp-state={hpState}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${hpPct}%`,
                    background: hpColor,
                    transition: 'all 0.3s ease',
                  }}
                />
              </div>

              <span
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: '0.6rem',
                  color: 'var(--dnd-parchment, #f0e6c8)',
                  fontWeight: 700,
                }}
              >
                {player.hp_current}
              </span>

              {/* Status badge */}
              <span
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: '0.45rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color:
                    player.status === 'dead'
                      ? '#e8a0a0'
                      : player.status === 'active'
                      ? '#6fcf97'
                      : 'var(--dnd-parchment-dim, #8a7a60)',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                }}
              >
                {player.status === 'dead' ? 'KO' : player.status === 'active' ? 'OK' : '??'}
              </span>
            </div>
          ) : (
            /* Expanded view */
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Identity */}
              <div>
                <h2
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '1.05rem',
                    color: 'var(--dnd-parchment, #f0e6c8)',
                    margin: 0,
                    marginBottom: '2px',
                  }}
                >
                  {player.character_name}
                </h2>
                <p
                  style={{
                    fontFamily: "'Lora', serif",
                    fontStyle: 'italic',
                    fontSize: '0.8rem',
                    color: 'var(--dnd-parchment-dim, #8a7a60)',
                    margin: 0,
                    marginBottom: '6px',
                  }}
                >
                  Level {player.level} {player.race} {player.character_class}
                </p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span
                    className="dnd-badge"
                    style={{
                      fontSize: '0.55rem',
                      color:
                        player.status === 'dead'
                          ? '#e8a0a0'
                          : player.status === 'active'
                          ? '#6fcf97'
                          : 'var(--dnd-parchment-dim, #8a7a60)',
                      border: `1px solid ${
                        player.status === 'dead'
                          ? 'rgba(192,57,43,0.4)'
                          : player.status === 'active'
                          ? 'rgba(45,106,79,0.4)'
                          : 'rgba(100,100,100,0.3)'
                      }`,
                      background:
                        player.status === 'dead'
                          ? 'rgba(139,34,50,0.12)'
                          : player.status === 'active'
                          ? 'rgba(45,106,79,0.12)'
                          : 'rgba(60,60,60,0.15)',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {player.status}
                  </span>
                  <span
                    data-testid="level-badge"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: '0.55rem',
                      color: 'var(--dnd-gold, #c9a84c)',
                      border: '1px solid rgba(201,168,76,0.35)',
                      background: 'rgba(201,168,76,0.08)',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {player.level}
                  </span>
                </div>
              </div>

              {/* HP section */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '4px',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    data-testid="hp-current-value"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      color: 'var(--dnd-parchment, #f0e6c8)',
                    }}
                  >
                    {player.hp_current}
                  </span>
                  <span style={{ color: 'var(--dnd-parchment-dim, #8a7a60)', fontSize: '0.9rem' }}>
                    /
                  </span>
                  <span
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: '1rem',
                      color: 'var(--dnd-parchment-dim, #8a7a60)',
                    }}
                  >
                    {player.hp_max}
                  </span>
                </div>

                {/* Horizontal HP bar */}
                <div
                  style={{
                    height: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    data-testid="hp-bar"
                    data-hp-state={hpState}
                    style={{
                      height: '100%',
                      width: `${hpPct}%`,
                      background: hpColor,
                      transition: 'all 0.3s ease',
                    }}
                  />
                </div>

                {player.hp_current === 0 && (
                  <p
                    data-testid="unconscious-label"
                    style={{
                      fontFamily: "'Lora', serif",
                      fontStyle: 'italic',
                      fontSize: '0.75rem',
                      color: '#e8a0a0',
                      marginTop: '4px',
                      margin: '4px 0 0 0',
                    }}
                  >
                    💀 Unconscious
                  </p>
                )}
              </div>

              {/* XP bar (DIN-28) */}
              {(() => {
                const XP_THRESHOLDS: Record<number, number> = { 1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500, 6: 14000 }
                const MVP_MAX_LEVEL = 5
                const xp = player.stats.xp ?? 0
                const lvl = player.level
                const currentThreshold = XP_THRESHOLDS[lvl] ?? 0
                const nextThreshold = XP_THRESHOLDS[lvl + 1]
                const isMaxLevel = lvl >= MVP_MAX_LEVEL
                const pct = isMaxLevel || !nextThreshold
                  ? 100
                  : Math.round(((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dnd-parchment-dim, #8a7a60)' }}>
                        Experience
                      </span>
                      <span style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: '0.65rem', color: 'var(--dnd-parchment-dim, #8a7a60)' }}>
                        {isMaxLevel
                          ? 'Max level'
                          : `${xp.toLocaleString()} / ${nextThreshold?.toLocaleString()} to Lv ${lvl + 1}`}
                      </span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        data-testid="xp-bar"
                        data-xp-pct={String(pct)}
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: 'var(--dnd-gold, #c9a84c)',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Ability Scores */}
              <div>
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.55rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--dnd-parchment-dim, #8a7a60)',
                    margin: '0 0 6px 0',
                  }}
                >
                  Ability Scores
                </p>
                <div
                  data-testid="ability-scores-grid"
                  className="dnd-stat-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px',
                  }}
                >
                  {STAT_NAMES.map(({ key, label }) => {
                    const score = player.stats[key as 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha']
                    return (
                      <div
                        key={key}
                        className="dnd-stat-box"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          borderRadius: '4px',
                          padding: '4px',
                          textAlign: 'center',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div
                          className="dnd-stat-label"
                          style={{
                            fontFamily: "'Cinzel', serif",
                            fontSize: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'var(--dnd-parchment-dim, #8a7a60)',
                          }}
                        >
                          {label}
                        </div>
                        <div
                          className="dnd-stat-value"
                          style={{
                            fontFamily: "'Cinzel', serif",
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: 'var(--dnd-parchment, #f0e6c8)',
                          }}
                        >
                          {score}
                        </div>
                        <div
                          className="dnd-stat-modifier"
                          style={{
                            fontFamily: "'Cinzel', serif",
                            fontSize: '0.6rem',
                            color: getModifier(score) >= 0 ? '#6fcf97' : '#e8a0a0',
                          }}
                        >
                          {formatModifier(score)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Spell Slots (DIN-27) — shown only for spellcasting classes */}
              {player.stats.spell_slots && (
                <div>
                  <p
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: '0.55rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--dnd-parchment-dim, #8a7a60)',
                      margin: '0 0 6px 0',
                    }}
                  >
                    Spell Slots
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(player.stats.spell_slots)
                      .filter(([, slot]) => slot.max > 0)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([level, slot]) => {
                        const ordinals: Record<string, string> = {
                          '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th',
                        }
                        const remaining = slot.max - slot.used
                        return (
                          <div key={level} data-testid={`spell-slot-row-${level}`}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <span
                                style={{
                                  fontFamily: "'Cinzel', serif",
                                  fontSize: '0.6rem',
                                  color: 'var(--dnd-parchment-dim, #8a7a60)',
                                  minWidth: '28px',
                                }}
                              >
                                {ordinals[level] ?? `${level}th`}
                              </span>
                              <span
                                data-testid={`spell-slot-label-${level}`}
                                style={{
                                  fontFamily: "'Cinzel', serif",
                                  fontSize: '0.6rem',
                                  color: 'var(--dnd-parchment, #f0e6c8)',
                                }}
                              >
                                {remaining} / {slot.max}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                              {Array.from({ length: slot.max }).map((_, i) => (
                                <span
                                  key={i}
                                  data-testid={i < slot.used ? 'pip-used' : 'pip-available'}
                                  style={{
                                    fontSize: '0.75rem',
                                    color: i < slot.used
                                      ? 'rgba(201,168,76,0.35)'
                                      : 'var(--dnd-gold, #c9a84c)',
                                  }}
                                >
                                  {i < slot.used ? '●' : '○'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                  </div>

                  {/* Cantrips */}
                  {player.stats.cantrips && player.stats.cantrips.length > 0 && (
                    <p
                      style={{
                        fontFamily: "'Lora', serif",
                        fontStyle: 'italic',
                        fontSize: '0.75rem',
                        color: 'var(--dnd-parchment-dim, #8a7a60)',
                        marginTop: '6px',
                        margin: '6px 0 0 0',
                      }}
                    >
                      Cantrips (∞): {player.stats.cantrips.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Inventory */}
              <div>
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.55rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--dnd-parchment-dim, #8a7a60)',
                    margin: '0 0 6px 0',
                  }}
                >
                  Inventory
                </p>
                {sortedInventory.length === 0 ? (
                  <p
                    style={{
                      fontFamily: "'Lora', serif",
                      fontStyle: 'italic',
                      fontSize: '0.8rem',
                      color: 'var(--dnd-parchment-dim, #8a7a60)',
                    }}
                  >
                    🎒 Empty
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {sortedInventory.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Lora', serif",
                            fontSize: '0.8rem',
                            color: 'var(--dnd-parchment, #f0e6c8)',
                          }}
                        >
                          {item.item_name}
                        </span>
                        {item.quantity > 1 && (
                          <span
                            className="dnd-badge"
                            style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: '0.55rem',
                              color: 'var(--dnd-gold, #c9a84c)',
                              background: 'rgba(201,168,76,0.1)',
                              border: '1px solid rgba(201,168,76,0.25)',
                              borderRadius: '3px',
                              padding: '1px 5px',
                            }}
                          >
                            ×{item.quantity}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
