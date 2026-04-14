'use client'

import { useEffect, useRef, useState } from 'react'

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

interface DiceRollerProps {
  dieType: DieType
  result?: number
  modifier?: number
  label: string
  onAnimationComplete: (result?: number) => void
  autoRoll?: boolean
  /** When true, skip animation and show result immediately (used for already-completed dice in a sequence) */
  instant?: boolean
}

const DIE_SIDES: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
}

// CSS clip-path shapes for each die type
const DIE_SHAPES: Record<DieType, string> = {
  d4: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  d6: 'inset(4px round 4px)',
  d8: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  d10: 'polygon(50% 0%, 100% 35%, 85% 100%, 15% 100%, 0% 35%)',
  d12: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
  d20: 'circle(50%)',
  d100: 'circle(50%)',
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

export function DiceRoller({
  dieType,
  result,
  modifier = 0,
  label,
  onAnimationComplete,
  autoRoll = false,
  instant = false,
}: DiceRollerProps) {
  const sides = DIE_SIDES[dieType]
  const shape = DIE_SHAPES[dieType]

  // Compute final result once at component creation time.
  // Use useState with an initialiser so it's computed once and stable across renders.
  const [finalResult] = useState<number>(() =>
    autoRoll ? rollDie(sides) : (result ?? 1)
  )

  const finalTotal = finalResult + modifier

  // Settle immediately when: reduced motion OR instant mode (pre-completed die in sequence)
  const reducedMotion = prefersReducedMotion()
  const skipAnimation = reducedMotion || instant
  const [displayNumber, setDisplayNumber] = useState<number>(finalResult)
  const [settled, setSettled] = useState(skipAnimation)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fire onAnimationComplete once on mount when animation is skipped
  useEffect(() => {
    if (skipAnimation) {
      onAnimationComplete(finalResult)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Animated path: flicker then settle
  useEffect(() => {
    if (skipAnimation) return

    intervalRef.current = setInterval(() => {
      setDisplayNumber(rollDie(sides))
    }, 80)

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setDisplayNumber(finalResult)
      setSettled(true)
      onAnimationComplete(finalResult)
    }, 1500)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showModifier = modifier !== 0

  return (
    <div
      className="dice-roller-embed"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '6px',
        background: 'rgba(45, 106, 79, 0.08)',
        border: '1px solid rgba(45, 106, 79, 0.2)',
        minWidth: '80px',
      }}
    >
      {/* Label */}
      <div
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: '0.6rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--dnd-parchment-dim, #8a7a60)',
        }}
      >
        {label}
      </div>

      {/* Die type badge */}
      <div
        data-testid="die-type-badge"
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: '0.65rem',
          color: 'var(--dnd-gold, #c9a84c)',
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: '3px',
          padding: '1px 5px',
        }}
      >
        {dieType}
      </div>

      {/* Die face */}
      <div
        data-testid="die-face"
        style={{
          width: '48px',
          height: '48px',
          clipPath: shape,
          background: settled
            ? 'rgba(45, 106, 79, 0.4)'
            : 'rgba(201, 168, 76, 0.2)',
          border: '2px solid rgba(201,168,76,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s ease',
        }}
      >
        <span
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--dnd-parchment, #f0e6c8)',
          }}
        >
          {displayNumber}
        </span>
      </div>

      {/* Total breakdown — only shown after animation completes */}
      {settled && (
        <div
          data-testid="dice-total"
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--dnd-parchment, #f0e6c8)',
          }}
        >
          {showModifier
            ? `${finalResult} ${modifier > 0 ? '+' : ''}${modifier} = ${finalTotal}`
            : `${finalTotal}`}
        </div>
      )}
    </div>
  )
}
