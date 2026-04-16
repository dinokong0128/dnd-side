import { render, screen } from '@testing-library/react'
import { StreamingDmMessage } from '../StreamingDmMessage'
import type { StreamSegment } from '@/lib/types/streaming'

jest.mock('@/components/dice/DiceRoller', () => ({
  DiceRoller: ({ dieType, result, label }: { dieType: string; result?: number; label: string }) => (
    <div data-testid={`dice-${dieType}`}>
      {label}: {result ?? ''}
    </div>
  ),
}))

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
})
