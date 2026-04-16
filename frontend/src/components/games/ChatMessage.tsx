'use client'

import React, { useState, useRef } from 'react'
import type { DiceRollEvent } from '@/lib/types/message'
import { DiceRoller } from '@/components/dice/DiceRoller'

interface ChatMessageProps {
  role: 'player' | 'dm' | 'system'
  characterName?: string
  content: string
  profileId?: string | null
  userId?: string
  isLastMessage?: boolean
  isWaitingForDm?: boolean
  diceRolls?: DiceRollEvent[] | null
  priorDeathSaves?: { successes: number; failures: number }
  onRetry?: () => void
  onDelete?: () => void
  onEdit?: (newContent: string) => void
}

export function ChatMessage({
  role,
  characterName,
  content,
  profileId,
  userId,
  isLastMessage,
  isWaitingForDm,
  diceRolls,
  priorDeathSaves,
  onRetry,
  onDelete,
  onEdit,
}: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(content)
  // Track how many dice have finished animating to reveal narration
  const settledCount = useRef(0)
  const [narrationVisible, setNarrationVisible] = useState(!diceRolls?.length)
  const [activeDieIndex, setActiveDieIndex] = useState(0)

  const canEditOrDelete =
    role === 'player' &&
    isLastMessage === true &&
    !!userId &&
    profileId === userId &&
    !isWaitingForDm

  const handleSave = () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    onEdit?.(trimmed)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditText(content)
    setIsEditing(false)
  }

  const hasDice = !!diceRolls?.length

  const handleDieComplete = () => {
    settledCount.current += 1
    if (hasDice) {
      if (settledCount.current < (diceRolls?.length ?? 0)) {
        // Advance to next die
        setActiveDieIndex(settledCount.current)
      } else {
        // All dice done — reveal narration
        setNarrationVisible(true)
      }
    }
  }

  if (role === 'dm') {
    return (
      <>
      <div className="mb-4 flex justify-start">
        <div
          className="max-w-2xl rounded-lg border px-5 py-4"
          style={{
            background: 'rgba(45, 106, 79, 0.12)',
            borderColor: 'rgba(45, 106, 79, 0.25)',
            animation: 'dnd-msg-fade-in 0.18s ease',
          }}
        >
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: '#6fcf97' }}
          >
            Dungeon Master
          </div>

          {/* Dice rolls rendered sequentially before narration.
              Only render dice up to and including activeDieIndex.
              Completed dice (idx < activeDieIndex) render as instant/settled. */}
          {hasDice && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              {diceRolls!.slice(0, activeDieIndex + 1).map((roll, idx) => {
                const isCritHit = roll.ac !== undefined && roll.result === 20
                const isCritMiss = roll.ac !== undefined && roll.result === 1
                return (
                  <div
                    key={idx}
                    data-testid={`dice-roll-card-${idx}`}
                    data-crit={isCritHit ? 'hit' : isCritMiss ? 'miss' : undefined}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      ...(isCritHit ? {
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: '#e4c65a',
                        borderRadius: '6px',
                        padding: '4px',
                      } : isCritMiss ? {
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: '#c0392b',
                        borderRadius: '6px',
                        padding: '4px',
                        opacity: 0.75,
                      } : {}),
                    }}
                  >
                    <DiceRoller
                      dieType={roll.die}
                      result={roll.result}
                      modifier={roll.modifier}
                      label={roll.label}
                      instant={idx < activeDieIndex}
                      onAnimationComplete={idx === activeDieIndex ? handleDieComplete : () => {}}
                    />
                    {/* Advantage/disadvantage pip display — shown after animation settles */}
                    {narrationVisible && roll.advantage !== undefined && Array.isArray(roll.all_rolls) && (
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem', marginTop: '2px' }}>
                        {roll.all_rolls.filter((r) => typeof r === 'number').map((r, ri) => {
                          const isKept = r === roll.result
                          return (
                            <span
                              key={ri}
                              data-testid={isKept ? 'adv-kept' : 'adv-discarded'}
                              style={{
                                color: isKept
                                  ? 'var(--dnd-parchment)'
                                  : 'var(--dnd-parchment-dim, rgba(230,210,170,0.45))',
                                textDecoration: isKept ? 'none' : 'line-through',
                                fontFamily: "'Cinzel', serif",
                                fontSize: '0.8rem',
                              }}
                            >
                              {r}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {/* Attack vs AC outcome — shown after animation settles */}
                    {narrationVisible && roll.ac !== undefined && (
                      <div
                        data-testid={`attack-outcome-${idx}`}
                        style={{
                          fontFamily: "'Cinzel', serif",
                          fontSize: '0.75rem',
                          letterSpacing: '0.04em',
                          textAlign: 'center',
                          color: roll.success ? '#6fcf97' : 'var(--dnd-parchment-dim, #b8a98c)',
                        }}
                      >
                        {roll.total} vs AC {roll.ac} — {roll.success ? 'Hit!' : 'Miss'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Outcome badge — appears after all dice settle, before narration */}
          {narrationVisible && diceRolls?.some(
            (r) => r.die === 'd20' && r.dc !== undefined && r.success !== undefined
          ) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {diceRolls!
                .filter((r) => r.die === 'd20' && r.dc !== undefined && r.success !== undefined)
                .map((roll, idx) => {
                  const isNat20 = roll.result === 20
                  const isNat1 = roll.result === 1
                  const isSuccess = !isNat1 && (roll.success || isNat20)

                  const label = isNat20
                    ? '💥 Critical Success'
                    : isNat1
                      ? '💀 Critical Failure'
                      : isSuccess
                        ? `✓ Success — vs DC ${roll.dc}`
                        : `✗ Failure — vs DC ${roll.dc}`

                  const bg = isSuccess
                    ? 'rgba(45,106,79,0.2)'
                    : 'rgba(139,34,50,0.2)'

                  const textColor = isSuccess ? '#6fcf97' : '#e8a0a0'

                  const borderColor = isNat20
                    ? 'var(--dnd-gold-bright, #f0d060)'
                    : isNat1
                      ? 'var(--dnd-crimson-bright, #e05050)'
                      : 'transparent'

                  return (
                    <React.Fragment key={idx}>
                      <div
                        data-testid="outcome-badge"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          background: bg,
                          border: `1px solid ${borderColor}`,
                          color: textColor,
                          fontSize: '0.78rem',
                          fontFamily: "'Cinzel', serif",
                          letterSpacing: '0.04em',
                        }}
                      >
                        {label}
                      </div>
                      {/* Death save cumulative tally */}
                      {roll.label === 'Death Saving Throw' && priorDeathSaves && (
                        <div
                          data-testid="death-save-tally"
                          style={{
                            fontFamily: "'Cinzel', serif",
                            fontSize: '0.7rem',
                            color: 'var(--dnd-parchment-dim, #b8a98c)',
                            letterSpacing: '0.04em',
                            alignSelf: 'center',
                          }}
                        >
                          Successes: {priorDeathSaves.successes + (roll.success ? 1 : 0)}/3
                          {' | '}
                          Failures: {priorDeathSaves.failures + (!roll.success ? 1 : 0)}/3
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
            </div>
          )}

          <p
            className="font-serif italic"
            style={{
              color: 'var(--dnd-parchment)',
              visibility: narrationVisible ? 'visible' : 'hidden',
            }}
          >
            {content}
          </p>
        </div>
      </div>
      <style jsx>{`
        @keyframes dnd-msg-fade-in {
          from { opacity: 0; transform: translateY(2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      </>
    )
  }

  if (role === 'player') {
    return (
      <div className="mb-4 flex justify-end">
        <div
          className="relative max-w-2xl rounded-lg border px-5 py-4"
          style={{
            background: 'rgba(201, 168, 76, 0.08)',
            borderColor: 'rgba(201, 168, 76, 0.15)',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {canEditOrDelete && isHovered && !isEditing && (
            <div
              style={{
                position: 'absolute',
                top: '-18px',
                right: 0,
                display: 'flex',
                gap: '4px',
              }}
            >
              <button
                data-testid="edit-message-btn"
                aria-label="Edit message"
                onClick={() => {
                  setEditText(content)
                  setIsEditing(true)
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid rgba(201,168,76,0.3)',
                  background: 'rgba(201,168,76,0.1)',
                  color: 'var(--dnd-gold)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M9.5 2.5L11.5 4.5L4 12H2V10L9.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                  <path d="M8.5 3.5L10.5 5.5" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
              <button
                data-testid="delete-message-btn"
                aria-label="Delete message"
                onClick={onDelete}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid rgba(192,57,43,0.3)',
                  background: 'rgba(139,34,50,0.1)',
                  color: '#e8a0a0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

          <div
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--dnd-gold)' }}
          >
            {characterName || 'Unknown Character'}
          </div>

          {isEditing ? (
            <div>
              <textarea
                data-testid="edit-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(201,168,76,0.05)',
                  border: '1px solid rgba(201,168,76,0.3)',
                  borderRadius: 4,
                  color: 'var(--dnd-parchment)',
                  padding: '6px 8px',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  data-testid="cancel-edit-btn"
                  onClick={handleCancel}
                  className="dnd-btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '0.65rem' }}
                >
                  Cancel
                </button>
                <button
                  data-testid="save-edit-btn"
                  onClick={handleSave}
                  disabled={!editText.trim()}
                  className="dnd-btn"
                  style={{ padding: '4px 12px', fontSize: '0.65rem' }}
                >
                  Save &amp; Resend
                </button>
              </div>
            </div>
          ) : (
            <p
              className="font-serif"
              style={{ color: 'var(--dnd-parchment)' }}
            >
              {content}
            </p>
          )}
        </div>
      </div>
    )
  }

  // System message
  return (
    <div className="mb-4 flex justify-center">
      <div
        className="max-w-2xl rounded-lg border px-5 py-4 text-center text-sm"
        style={{
          background: 'rgba(139,34,50,0.15)',
          borderColor: 'rgba(192,57,43,0.3)',
        }}
      >
        <div
          style={{
            color: '#e8a0a0',
            fontFamily: "'Cinzel', serif",
            fontSize: '0.65rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}
        >
          System
        </div>
        <p className="font-serif italic" style={{ color: '#e8a0a0' }}>
          {content}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="dnd-btn-secondary"
            style={{ marginTop: '10px', padding: '5px 14px', fontSize: '0.65rem' }}
          >
            ↩ Retry last action
          </button>
        )}
      </div>
    </div>
  )
}
