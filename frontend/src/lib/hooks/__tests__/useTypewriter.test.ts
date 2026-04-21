import { act, renderHook } from '@testing-library/react'
import { useTypewriter } from '../useTypewriter'

type RafCallback = (t: number) => void

let rafCallbacks: RafCallback[] = []
let currentTime = 0

const flush = (dtMs: number): void => {
  currentTime += dtMs
  const toRun = rafCallbacks
  rafCallbacks = []
  act(() => {
    for (const cb of toRun) cb(currentTime)
  })
}

const flushFrames = (count: number, dtMs = 16): void => {
  for (let i = 0; i < count; i++) flush(dtMs)
}

beforeEach(() => {
  rafCallbacks = []
  currentTime = 0
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: RafCallback): number => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useTypewriter', () => {
  it('stays at 0 when target is 0', () => {
    const { result } = renderHook(() => useTypewriter(0, 100))
    flushFrames(60)
    expect(result.current).toBe(0)
  })

  it('reaches target at roughly cps over time', () => {
    const { result } = renderHook(() => useTypewriter(100, 100))
    // 1.05s of simulated ticks (~65 frames at 16ms) — 100 chars @ 100cps = 1s.
    flushFrames(70)
    expect(result.current).toBe(100)
  })

  it('catches up faster than the steady rate when a large backlog exists', () => {
    // At pure cps=100 for 1.5s we would only reveal 150 chars. With the
    // deficit/1.5 catch-up clamp active, revealed should comfortably exceed
    // that bound for a target of 300.
    const { result } = renderHook(() => useTypewriter(300, 100))
    flushFrames(94) // ~1.5s of simulated ticks at 16ms
    expect(result.current).toBeGreaterThan(150)
  })

  it('continues climbing when target grows mid-animation', () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: number }) => useTypewriter(target, 100),
      { initialProps: { target: 50 } }
    )
    flushFrames(35) // ~0.56s, should reach 50
    expect(result.current).toBe(50)

    rerender({ target: 150 })
    flushFrames(70) // another ~1.1s, plenty to close the 100-char gap
    expect(result.current).toBe(150)
  })

  it('clamps revealed down when target shrinks below it', () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: number }) => useTypewriter(target, 100),
      { initialProps: { target: 100 } }
    )
    flushFrames(70)
    expect(result.current).toBe(100)

    rerender({ target: 30 })
    // target-shrink clamp runs in a useEffect; flush a frame so the state
    // update is observable.
    flushFrames(1)
    expect(result.current).toBe(30)
  })
})
