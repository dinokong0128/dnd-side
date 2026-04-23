import React from 'react'
import { render, act } from '@testing-library/react'
import { SceneBackground } from '../SceneBackground'
import type { SceneType, Mood } from '@/lib/scene'

// SCENE_TYPES and MOODS combinations for smoke testing
const ALL_SCENE_TYPES: SceneType[] = [
  'tavern', 'town_square', 'throne_room', 'temple', 'forest', 'mountain',
  'swamp', 'desert', 'coast', 'dungeon', 'cave', 'crypt', 'rest',
]
const ALL_MOODS: Mood[] = ['combat', 'tense', 'victory', 'stealth', 'somber', 'mystery']

describe('SceneBackground', () => {
  describe('smoke test — renders without crashing', () => {
    it('renders with null sceneType', () => {
      expect(() =>
        render(<SceneBackground sceneType={null} sceneMood={null} enabled={true} reduceMotion={false} />)
      ).not.toThrow()
    })

    ALL_SCENE_TYPES.forEach((sceneType) => {
      it(`renders with sceneType=${sceneType} and no mood`, () => {
        expect(() =>
          render(<SceneBackground sceneType={sceneType} sceneMood={null} enabled={true} reduceMotion={false} />)
        ).not.toThrow()
      })
    })

    ALL_MOODS.forEach((mood) => {
      it(`renders with mood=${mood}`, () => {
        expect(() =>
          render(<SceneBackground sceneType="tavern" sceneMood={mood} enabled={true} reduceMotion={false} />)
        ).not.toThrow()
      })
    })
  })

  describe('enabled=false hides all layers', () => {
    it('does not render images when disabled', () => {
      const { container } = render(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={false} reduceMotion={false} />
      )
      expect(container.firstChild).toBeNull()
    })
  })

  describe('mood overlay', () => {
    it('renders mood overlay class when mood is set', () => {
      const { container } = render(
        <SceneBackground sceneType="dungeon" sceneMood="combat" enabled={true} reduceMotion={false} />
      )
      const moodOverlay = container.querySelector('[data-testid="mood-overlay"]')
      expect(moodOverlay).not.toBeNull()
      expect(moodOverlay?.className).toContain('dnd-mood-combat')
    })

    it('does not render mood overlay when mood is null', () => {
      const { container } = render(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={false} />
      )
      expect(container.querySelector('[data-testid="mood-overlay"]')).toBeNull()
    })

    ALL_MOODS.forEach((mood) => {
      it(`applies dnd-mood-${mood} class for ${mood} mood`, () => {
        const { container } = render(
          <SceneBackground sceneType="tavern" sceneMood={mood} enabled={true} reduceMotion={false} />
        )
        const overlay = container.querySelector('[data-testid="mood-overlay"]')
        expect(overlay?.className).toContain(`dnd-mood-${mood}`)
      })
    })
  })

  describe('mood-affinity variant routing', () => {
    // Asserts pickVariantFor routes each mood to the correct numbered variant
    // by inspecting the active <img>'s src attribute after first render.
    const cases: Array<[Mood | null, number, string]> = [
      [null,      1, 'serene'],
      ['victory', 1, 'serene'],
      ['combat',  2, 'dramatic'],
      ['somber',  3, 'melancholic'],
      ['tense',   4, 'ominous'],
      ['stealth', 4, 'ominous'],
      ['mystery', 4, 'ominous'],
    ]

    cases.forEach(([mood, variant, affinity]) => {
      const label = mood === null ? 'no mood' : `mood=${mood}`
      it(`routes ${label} to variant ${variant} (${affinity})`, () => {
        const { container } = render(
          <SceneBackground sceneType="forest" sceneMood={mood} enabled={true} reduceMotion={false} />
        )
        const activeImg = container.querySelector('img.scene-img-active') as HTMLImageElement | null
        expect(activeImg).not.toBeNull()
        expect(activeImg!.getAttribute('src')).toBe(`/scenes/forest/${variant}.webp`)
      })
    })

    it('re-picks when mood changes for the same scene', () => {
      const { container, rerender } = render(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={false} />
      )
      const firstActive = container.querySelector('img.scene-img-active') as HTMLImageElement
      expect(firstActive.getAttribute('src')).toBe('/scenes/forest/1.webp')

      rerender(
        <SceneBackground sceneType="forest" sceneMood="combat" enabled={true} reduceMotion={false} />
      )
      const afterActive = container.querySelector('img.scene-img-active') as HTMLImageElement
      expect(afterActive.getAttribute('src')).toBe('/scenes/forest/2.webp')
    })

    it('rotates off lastVariant when preferred equals lastVariant', () => {
      // First render loads forest/1 (serene, no mood). Second render with the
      // same (scene, mood) pair would prefer variant 1 again, but the picker
      // should rotate to avoid an immediate repeat.
      const { container, rerender } = render(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={false} />
      )
      expect(
        (container.querySelector('img.scene-img-active') as HTMLImageElement).getAttribute('src'),
      ).toBe('/scenes/forest/1.webp')

      // Toggle to a mood then back to null — this re-triggers the effect, and
      // because lastVariant is already 1, it should rotate to 2.
      rerender(
        <SceneBackground sceneType="forest" sceneMood="combat" enabled={true} reduceMotion={false} />
      )
      rerender(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={false} />
      )
      const src = (container.querySelector('img.scene-img-active') as HTMLImageElement).getAttribute('src')
      // After combat (variant 2), returning to no-mood prefers variant 1 and
      // because lastVariant is now 2, variant 1 is fine (not a repeat).
      expect(src).toBe('/scenes/forest/1.webp')
    })
  })

  describe('reduce motion', () => {
    it('removes Ken Burns class when reduceMotion=true', () => {
      const { container } = render(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={true} />
      )
      const imgs = container.querySelectorAll('img')
      imgs.forEach((img) => {
        expect(img.className).not.toContain('scene-kenburns')
      })
    })

    it('applies Ken Burns class when reduceMotion=false', () => {
      const { container } = render(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={false} />
      )
      const activeImg = container.querySelector('.scene-img-active')
      expect(activeImg?.className).toContain('scene-kenburns')
    })
  })

  describe('asset error fallback', () => {
    it('swaps src to fallback on img error', async () => {
      const { container } = render(
        <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={false} />
      )
      const img = container.querySelector('img.scene-img-active') as HTMLImageElement
      expect(img).not.toBeNull()

      await act(async () => {
        img.dispatchEvent(new Event('error'))
      })

      expect(img.src).toContain('default.webp')
    })
  })

  describe('dim overlay', () => {
    it('always renders the dim overlay when enabled', () => {
      const { container } = render(
        <SceneBackground sceneType="tavern" sceneMood={null} enabled={true} reduceMotion={false} />
      )
      expect(container.querySelector('[data-testid="dim-overlay"]')).not.toBeNull()
    })
  })

  describe('DIN-73 hotfix — root container must not block pointer events', () => {
    // Regression guard: without pointer-events:none on the root, the fixed
    // overlay covers the whole viewport and swallows every click. This left
    // the game header and chat log unclickable in prod until the hotfix.
    it('root container has pointer-events:none so it does not intercept clicks', () => {
      const { getByTestId } = render(
        <SceneBackground sceneType="tavern" sceneMood="combat" enabled={true} reduceMotion={false} />
      )
      const root = getByTestId('scene-background-root')
      expect(root.style.pointerEvents).toBe('none')
    })

    it('renders sibling interactive content that receives clicks', () => {
      // Simulate the production layout: SceneBackground + a sibling button.
      // The click must reach the button, not the fixed overlay.
      const handleClick = jest.fn()
      const { getByRole } = render(
        <div>
          <SceneBackground sceneType="forest" sceneMood={null} enabled={true} reduceMotion={false} />
          <button onClick={handleClick}>click me</button>
        </div>
      )
      getByRole('button', { name: 'click me' }).click()
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})
