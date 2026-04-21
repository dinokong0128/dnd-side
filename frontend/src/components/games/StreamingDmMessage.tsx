'use client'

import { Fragment, useRef, useState } from 'react'
import type { StreamSegment } from '@/lib/types/streaming'
import type { DiceRollEvent } from '@/lib/types/message'
import { DiceRoller } from '@/components/dice/DiceRoller'
import { useTypewriter } from '@/lib/hooks/useTypewriter'
import { splitParagraphs } from '@/lib/utils/text'

interface StreamingDmMessageProps {
  segments: StreamSegment[]
}

type PlanItem =
  | { kind: 'text'; content: string; isCurrent: boolean }
  | { kind: 'dice_rolls'; content: string }

/** Parse the JSON content of a dice_rolls block. [] on any failure. */
function parseDiceRolls(content: string): DiceRollEvent[] {
  try {
    const parsed = JSON.parse(content.trim())
    if (Array.isArray(parsed)) return parsed as DiceRollEvent[]
  } catch {
    // Non-fatal — malformed content just renders as no dice.
  }
  return []
}

/**
 * Animated dice block for a streaming DM response.
 *
 * Mirrors the sequential animation + outcome-badge logic from ChatMessage:
 * dice reveal one at a time; the green/red outcome badge appears after all
 * dice settle. Mounted once when the complete block arrives mid-stream.
 */
function StreamingDiceBlock({ rolls }: { rolls: DiceRollEvent[] }) {
  const settledCountRef = useRef(0)
  const [activeDieIndex, setActiveDieIndex] = useState(0)
  const [allSettled, setAllSettled] = useState(false)

  const handleDieComplete = () => {
    settledCountRef.current += 1
    if (settledCountRef.current < rolls.length) {
      setActiveDieIndex(settledCountRef.current)
    } else {
      setAllSettled(true)
    }
  }

  return (
    <>
      {/* Dice rendered sequentially — same pattern as ChatMessage */}
      <div
        data-testid="streaming-dice"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {rolls.slice(0, activeDieIndex + 1).map((roll, idx) => {
          const isCritHit = roll.ac !== undefined && roll.result === 20
          const isCritMiss = roll.ac !== undefined && roll.result === 1
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                ...(isCritHit
                  ? {
                      border: '2px solid #e4c65a',
                      borderRadius: '6px',
                      padding: '4px',
                    }
                  : isCritMiss
                    ? {
                        border: '2px solid #c0392b',
                        borderRadius: '6px',
                        padding: '4px',
                        opacity: 0.75,
                      }
                    : {}),
              }}
            >
              <DiceRoller
                dieType={roll.die}
                result={roll.result}
                modifier={roll.modifier}
                label={roll.label}
                instant={idx < activeDieIndex}
                onAnimationComplete={
                  idx === activeDieIndex ? handleDieComplete : () => {}
                }
              />
              {/* Attack vs AC outcome — after animation settles */}
              {allSettled && roll.ac !== undefined && (
                <div
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.75rem',
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    color: roll.success
                      ? '#6fcf97'
                      : 'var(--dnd-parchment-dim, #b8a98c)',
                  }}
                >
                  {roll.total} vs AC {roll.ac} — {roll.success ? 'Hit!' : 'Miss'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Outcome badge for ability checks / saving throws — after all dice settle */}
      {allSettled &&
        rolls.some(
          (r) => r.die === 'd20' && r.dc !== undefined && r.success !== undefined
        ) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            {rolls
              .filter(
                (r) =>
                  r.die === 'd20' &&
                  r.dc !== undefined &&
                  r.success !== undefined
              )
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
                  <div
                    key={idx}
                    data-testid="streaming-outcome-badge"
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
                )
              })}
          </div>
        )}
    </>
  )
}

/**
 * Live DM response bubble rendered while a stream is in flight (DIN-66).
 *
 * Interleaves plain text with animated dice_rolls blocks. A requestAnimationFrame-
 * driven typewriter reveals text at ~100 cps (with a 1.5s catch-up clamp) so the
 * reveal stays smooth even when the backend bursts large chunks. Dice blocks are
 * gated behind any still-typing preceding text so they never animate ahead of
 * their narration. The last rendered text segment gets a blinking cursor.
 */
export function StreamingDmMessage({ segments }: StreamingDmMessageProps) {
  const targetChars = segments.reduce(
    (n, s) => n + (s.kind === 'text' ? s.content.length : 0),
    0
  )
  const revealed = useTypewriter(targetChars, 100)

  const plan: PlanItem[] = []
  let budget = revealed
  let halted = false
  for (const seg of segments) {
    if (halted) break
    if (seg.kind === 'text') {
      const take = Math.min(seg.content.length, Math.max(0, budget))
      const isCurrent = take < seg.content.length
      plan.push({
        kind: 'text',
        content: seg.content.slice(0, take),
        isCurrent,
      })
      budget -= seg.content.length
      if (isCurrent) halted = true
    } else {
      plan.push({ kind: 'dice_rolls', content: seg.content })
    }
  }

  // Cursor anchors to the current (still-typing) text item if present,
  // otherwise to the last rendered text item.
  let cursorPlanIdx = -1
  for (let i = plan.length - 1; i >= 0; i--) {
    const item = plan[i]
    if (item.kind === 'text' && item.isCurrent) {
      cursorPlanIdx = i
      break
    }
  }
  if (cursorPlanIdx === -1) {
    for (let i = plan.length - 1; i >= 0; i--) {
      if (plan[i].kind === 'text') {
        cursorPlanIdx = i
        break
      }
    }
  }

  // Fall back to the empty-cursor paragraph when the plan has no renderable
  // text yet (plan empty, dice-only, or the cursor host's slice is still empty).
  const cursorHost = cursorPlanIdx >= 0 ? plan[cursorPlanIdx] : null
  const showEmptyCursor =
    !cursorHost ||
    cursorHost.kind !== 'text' ||
    cursorHost.content.length === 0

  return (
    <div className="mb-4 flex justify-start" data-testid="streaming-dm-message">
      <div
        className="max-w-2xl rounded-lg border px-5 py-4"
        style={{
          background: 'rgba(45, 106, 79, 0.12)',
          borderColor: 'rgba(45, 106, 79, 0.25)',
        }}
      >
        <div
          className="mb-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: '#6fcf97' }}
        >
          Dungeon Master
        </div>

        {plan.map((item, idx) => {
          if (item.kind === 'dice_rolls') {
            const rolls = parseDiceRolls(item.content)
            return <StreamingDiceBlock key={`dice-${idx}`} rolls={rolls} />
          }

          const isCursorHost = idx === cursorPlanIdx
          const paragraphs = splitParagraphs(item.content)
          return (
            <Fragment key={`text-${idx}`}>
              {paragraphs.map((para, pIdx) => {
                const isLastPara = pIdx === paragraphs.length - 1
                const isVeryLast = isCursorHost && isLastPara
                return (
                  <p
                    key={`text-${idx}-p${pIdx}`}
                    className="font-serif italic"
                    style={{
                      color: 'var(--dnd-parchment)',
                      margin: 0,
                      marginBottom: isLastPara ? 0 : '0.4em',
                    }}
                  >
                    {para}
                    {isVeryLast && (
                      <span
                        aria-hidden="true"
                        data-testid="streaming-cursor"
                        className="streaming-cursor"
                      >
                        |
                      </span>
                    )}
                  </p>
                )
              })}
            </Fragment>
          )
        })}

        {showEmptyCursor && (
          <p
            className="font-serif italic"
            style={{ color: 'var(--dnd-parchment)' }}
          >
            <span
              aria-hidden="true"
              data-testid="streaming-cursor"
              className="streaming-cursor"
            >
              |
            </span>
          </p>
        )}
      </div>

      <style jsx>{`
        :global(.streaming-cursor) {
          display: inline-block;
          margin-left: 1px;
          animation: dnd-stream-cursor 0.7s ease-in-out infinite;
        }
        @keyframes dnd-stream-cursor {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
