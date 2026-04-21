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
})
