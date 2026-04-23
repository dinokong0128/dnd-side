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
    if (!enabled) return

    // When the DM hasn't emitted a <scene> tag yet (brand-new game, or a
    // game whose messages pre-date DIN-73), fall back to the neutral
    // campfire image so the player isn't staring at black. Any later
    // scene_type value from the DM will crossfade in normally.
    let src: string
    if (sceneType) {
      const last = lastVariantRef.current[sceneType] ?? 0
      const variant = pickVariantFor(sceneType, sceneMood, last)
      lastVariantRef.current[sceneType] = variant
      src = `/scenes/${sceneType}/${variant}.webp`
    } else {
      src = FALLBACK_SRC
    }

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
      data-testid="scene-background-root"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        // z-index:-1 keeps the overlay strictly behind the page's in-flow,
        // non-positioned content (header, chat, input). Combined with
        // `.scene-bg-active { position: relative; isolation: isolate; }` in
        // globals.css, the overlay sits inside .dnd-page-bg's own stacking
        // context so its fixed positioning does not escape to the viewport
        // root. Without that parent isolation + this negative z-index, the
        // fixed overlay painted on top of the UI.
        zIndex: -1,
        overflow: 'hidden',
        // Purely visual: belt-and-suspenders so the root cannot swallow
        // pointer events even if a sibling's stacking rules somehow put it
        // over interactive content.
        pointerEvents: 'none',
      }}
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
