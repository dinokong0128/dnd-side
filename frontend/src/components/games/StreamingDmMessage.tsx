'use client'

import type { StreamSegment } from '@/lib/types/streaming'
import type { DiceRollEvent } from '@/lib/types/message'
import { DiceRoller } from '@/components/dice/DiceRoller'

interface StreamingDmMessageProps {
  segments: StreamSegment[]
}

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
 * Live DM response bubble rendered while a stream is in flight (DIN-66).
 *
 * Interleaves plain text with complete dice_rolls blocks. The last text
 * segment gets a blinking cursor. Unmounts as soon as the real Realtime
 * DM INSERT arrives and the parent clears `streamingSegments` to null.
 */
export function StreamingDmMessage({ segments }: StreamingDmMessageProps) {
  // Find the last text segment so the cursor anchors to it.
  let lastTextIdx = -1
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].kind === 'text') {
      lastTextIdx = i
      break
    }
  }

  const showEmptyCursor = segments.length === 0

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

        {segments.map((segment, idx) => {
          if (segment.kind === 'dice_rolls') {
            const rolls = parseDiceRolls(segment.content)
            return (
              <div
                key={`dice-${idx}`}
                data-testid="streaming-dice"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                {rolls.map((roll, ri) => (
                  <DiceRoller
                    key={ri}
                    dieType={roll.die}
                    result={roll.result}
                    modifier={roll.modifier}
                    label={roll.label}
                    instant
                    onAnimationComplete={() => {}}
                  />
                ))}
              </div>
            )
          }

          const isLastText = idx === lastTextIdx
          return (
            <p
              key={`text-${idx}`}
              className="font-serif italic"
              style={{ color: 'var(--dnd-parchment)', whiteSpace: 'pre-wrap' }}
            >
              {segment.content}
              {isLastText && (
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
