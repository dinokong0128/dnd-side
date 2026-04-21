import { act, render, screen } from '@testing-library/react'
import { StreamingDmMessage } from '../StreamingDmMessage'
import type { StreamSegment } from '@/lib/types/streaming'

jest.mock('@/components/dice/DiceRoller', () => ({
  DiceRoller: ({ dieType, result, label }: { dieType: string; result?: number; label: string }) => (
    <div data-testid={`dice-${dieType}`}>
      {label}: {result ?? ''}
    </div>
  ),
}))

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

/** Advance enough simulated frames to fully reveal any plausible stream. */
const flushToComplete = (): void => {
  // 3 simulated seconds at 16ms/frame = 188 frames — more than enough at
  // 100cps + 1.5s catch-up clamp for anything the unit tests throw at us.
  flushFrames(200)
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

describe('StreamingDmMessage', () => {
  it('renders a blinking cursor when the segment list is empty', () => {
    render(<StreamingDmMessage segments={[]} />)
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument()
    expect(screen.getByText('Dungeon Master')).toBeInTheDocument()
  })

  it('renders a text segment with a trailing cursor', () => {
    const segments: StreamSegment[] = [
      { kind: 'text', content: 'The goblin lunges.' },
    ]
    render(<StreamingDmMessage segments={segments} />)
    flushToComplete()
    expect(screen.getByText(/The goblin lunges\./)).toBeInTheDocument()
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument()
  })

  it('renders dice_rolls as complete DiceRoller components (never partial XML)', () => {
    const diceContent = JSON.stringify([
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 15,
        modifier: 2,
        total: 17,
        label: 'Stealth',
      },
    ])

    const segments: StreamSegment[] = [
      { kind: 'text', content: 'Rolling for stealth... ' },
      { kind: 'dice_rolls', content: diceContent },
      { kind: 'text', content: 'You sneak past.' },
    ]
    render(<StreamingDmMessage segments={segments} />)
    flushToComplete()

    expect(screen.getByTestId('streaming-dice')).toBeInTheDocument()
    expect(screen.getByTestId('dice-d20')).toHaveTextContent(/Stealth/)
    expect(screen.getByText(/Rolling for stealth/)).toBeInTheDocument()
    expect(screen.getByText(/You sneak past\./)).toBeInTheDocument()
  })

  it('places cursor on the last text segment, not on dice segments', () => {
    const segments: StreamSegment[] = [
      { kind: 'text', content: 'First. ' },
      {
        kind: 'dice_rolls',
        content:
          '[{"type":"dice_roll","die":"d20","count":1,"result":10,"modifier":0,"total":10,"label":"Roll"}]',
      },
      { kind: 'text', content: 'Last.' },
    ]
    render(<StreamingDmMessage segments={segments} />)
    flushToComplete()
    const cursors = screen.getAllByTestId('streaming-cursor')
    expect(cursors).toHaveLength(1)
  })

  it('gracefully handles malformed dice_rolls content', () => {
    const segments: StreamSegment[] = [
      { kind: 'dice_rolls', content: 'not-json' },
    ]
    render(<StreamingDmMessage segments={segments} />)
    expect(screen.getByTestId('streaming-dice')).toBeInTheDocument()
    expect(screen.queryByTestId('dice-d20')).not.toBeInTheDocument()
  })

  it('reveals text progressively via the typewriter (not all at once)', () => {
    const long = 'A'.repeat(500)
    const segments: StreamSegment[] = [{ kind: 'text', content: long }]
    render(<StreamingDmMessage segments={segments} />)

    // After one frame (~16ms at 100cps) only ~1-2 chars are revealed.
    flushFrames(2)
    const partial = screen.getByTestId('streaming-dm-message').textContent ?? ''
    // Remove the "Dungeon Master" label prefix before measuring.
    const rendered = partial.replace('Dungeon Master', '')
    expect(rendered.length).toBeLessThan(long.length)
  })

  it('gates dice blocks behind still-typing preceding text', () => {
    const diceContent =
      '[{"type":"dice_roll","die":"d20","count":1,"result":10,"modifier":0,"total":10,"label":"Roll"}]'
    const segments: StreamSegment[] = [
      { kind: 'text', content: 'Hello' },
      { kind: 'dice_rolls', content: diceContent },
    ]
    render(<StreamingDmMessage segments={segments} />)

    // Before the text is fully revealed, the dice block must not render.
    flushFrames(1)
    expect(screen.queryByTestId('streaming-dice')).not.toBeInTheDocument()

    // After the reveal completes, the dice block appears.
    flushToComplete()
    expect(screen.getByTestId('streaming-dice')).toBeInTheDocument()
  })

  it('preserves paragraph breaks on \\n\\n within a single text segment', () => {
    const segments: StreamSegment[] = [
      { kind: 'text', content: 'Paragraph one.\n\nParagraph two.' },
    ]
    const { container } = render(<StreamingDmMessage segments={segments} />)
    flushToComplete()

    const paragraphs = container.querySelectorAll('p')
    // Two <p>s for the two paragraphs; no extra empty-cursor <p>.
    expect(paragraphs.length).toBe(2)
    expect(paragraphs[0].textContent).toContain('Paragraph one.')
    expect(paragraphs[1].textContent).toContain('Paragraph two.')
  })

  it('keeps the cursor on the final paragraph once the stream fully reveals', () => {
    const segments: StreamSegment[] = [
      { kind: 'text', content: 'Alpha.\n\nBeta.' },
    ]
    const { container } = render(<StreamingDmMessage segments={segments} />)
    flushToComplete()

    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs.length).toBe(2)
    // Cursor should be within the last paragraph.
    expect(paragraphs[1].querySelector('[data-testid="streaming-cursor"]')).toBeTruthy()
    expect(paragraphs[0].querySelector('[data-testid="streaming-cursor"]')).toBeFalsy()
  })
})
