'use client'

import { useEffect, useRef, useState } from 'react'
import type { SceneType, Mood } from '@/lib/scene'
import { pickVariantFor } from '@/lib/scene-variants'

const FALLBACK_SRC = '/scenes/rest/default.webp'

interface Props {
  sceneType: SceneType | null
  sceneMood: Mood | null
  enabled: boolean
  reduceMotion: boolean
}

export function SceneBackground({ sceneType, sceneMood, enabled, reduceMotion }: Props) {
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a')
  const [slotA, setSlotA] = useState<string | null>(null)
  const [slotB, setSlotB] = useState<string | null>(null)
  // Track the last variant shown per scene type so the picker can avoid
  // immediate repeats (e.g. mood unchanged across two turns).
  const lastVariantRef = useRef<Record<string, number>>({})
  // Mirrors activeSlot as a ref so the effect always reads the current slot
  // without needing it as a dependency (which would re-trigger transitions).
  const activeSlotRef = useRef<'a' | 'b'>('a')

  useEffect(() => {
    if (!sceneType || !enabled) return

    const last = lastVariantRef.current[sceneType] ?? 0
    const variant = pickVariantFor(sceneType, sceneMood, last)
    lastVariantRef.current[sceneType] = variant
    const src = `/scenes/${sceneType}/${variant}.webp`

    // Updating image slots is this effect's entire purpose.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeSlotRef.current === 'a') {
      setSlotB(src)
      setActiveSlot('b')
      activeSlotRef.current = 'b'
    } else {
      setSlotA(src)
      setActiveSlot('a')
      activeSlotRef.current = 'a'
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [sceneType, sceneMood, enabled])

  if (!enabled) return null

  const activeSrc = activeSlot === 'a' ? slotA : slotB
  const inactiveSrc = activeSlot === 'a' ? slotB : slotA

  const imgBase = 'absolute inset-0 w-full h-full object-cover'
  const transitionStyle = reduceMotion ? {} : { transition: 'opacity 800ms ease-in-out' }

  function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    if (!img.src.endsWith(FALLBACK_SRC)) {
      img.src = FALLBACK_SRC
    }
  }

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}
    >
      {/* Inactive slot (fading out) */}
      {inactiveSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={inactiveSrc}
          alt=""
          className={`${imgBase} scene-img-inactive`}
          style={{ opacity: 0, ...transitionStyle }}
          onError={handleError}
        />
      )}

      {/* Active slot (fading in / Ken Burns) */}
      {activeSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeSrc}
          alt=""
          className={`${imgBase} scene-img-active${!reduceMotion ? ' scene-kenburns' : ''}`}
          style={{ opacity: 1, ...transitionStyle }}
          onError={handleError}
        />
      )}

      {/* Mood overlay */}
      {sceneMood && (
        <div
          data-testid="mood-overlay"
          className={`dnd-mood-overlay dnd-mood-${sceneMood}`}
          style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
        />
      )}

      {/* Dim overlay for text contrast */}
      <div
        data-testid="dim-overlay"
        className="dnd-dim-overlay"
        style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}
      />
    </div>
  )
}
