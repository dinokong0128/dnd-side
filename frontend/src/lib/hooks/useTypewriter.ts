import { useEffect, useRef, useState } from 'react'

const MAX_LATENCY_SECONDS = 1.5

/**
 * Drives a character-by-character reveal of `target` characters at roughly
 * `cps` characters per second. Uses a single long-lived requestAnimationFrame
 * loop and clamps up to MAX_LATENCY_SECONDS of backlog so bursty backend
 * chunks still land within ~1.5s without sacrificing the steady reveal feel.
 */
export function useTypewriter(target: number, cps: number): number {
  const [revealedInt, setRevealedInt] = useState<number>(0)
  const revealedRef = useRef<number>(0)
  const targetRef = useRef<number>(target)
  const cpsRef = useRef<number>(cps)

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    cpsRef.current = cps
  }, [cps])

  useEffect(() => {
    let rafId = 0
    let lastTime: number | null = null

    const tick = (now: number): void => {
      if (lastTime === null) lastTime = now
      const dt = (now - lastTime) / 1000
      lastTime = now

      const tgt = targetRef.current
      if (revealedRef.current > tgt) revealedRef.current = tgt
      const deficit = tgt - revealedRef.current
      const effectiveCps = Math.max(cpsRef.current, deficit / MAX_LATENCY_SECONDS)
      revealedRef.current = Math.min(tgt, revealedRef.current + dt * effectiveCps)

      const floored = Math.floor(revealedRef.current)
      setRevealedInt((prev) => (prev !== floored ? floored : prev))

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Derive the clamp from `target` during render so a shrinking target is
  // reflected immediately (the rAF loop catches up the ref on its next tick).
  return Math.min(revealedInt, target)
}
