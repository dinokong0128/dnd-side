import { render, screen, act } from '@testing-library/react'
import { DiceRoller } from '../DiceRoller'

// Mock timers for animation control
beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

describe('DiceRoller', () => {
  const defaultProps = {
    dieType: 'd20' as const,
    result: 14,
    modifier: 0,
    label: 'Stealth Check',
    onAnimationComplete: jest.fn(),
  }

  it('renders the label', () => {
    render(<DiceRoller {...defaultProps} />)
    expect(screen.getByText('Stealth Check')).toBeInTheDocument()
  })

  it('shows the result after animation completes', () => {
    render(<DiceRoller {...defaultProps} result={14} modifier={3} />)
    act(() => {
      jest.runAllTimers()
    })
    expect(screen.getByTestId('dice-total')).toHaveTextContent('17')
  })

  it('shows result with no modifier when modifier is 0', () => {
    render(<DiceRoller {...defaultProps} result={18} modifier={0} />)
    act(() => {
      jest.runAllTimers()
    })
    expect(screen.getByTestId('dice-total')).toHaveTextContent('18')
  })

  it('calls onAnimationComplete after animation finishes', () => {
    const onAnimationComplete = jest.fn()
    render(<DiceRoller {...defaultProps} onAnimationComplete={onAnimationComplete} />)
    act(() => {
      jest.runAllTimers()
    })
    expect(onAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it('respects prefers-reduced-motion by showing result immediately', () => {
    // Mock matchMedia to return prefers-reduced-motion: reduce
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
    const onAnimationComplete = jest.fn()
    render(<DiceRoller {...defaultProps} result={12} modifier={2} onAnimationComplete={onAnimationComplete} />)
    // Should show result immediately without running timers
    expect(screen.getByTestId('dice-total')).toHaveTextContent('14')
    expect(onAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it('displays die type badge', () => {
    render(<DiceRoller {...defaultProps} dieType="d20" />)
    expect(screen.getByTestId('die-type-badge')).toHaveTextContent('d20')
  })

  it('autoRoll mode generates a result and calls onAnimationComplete', () => {
    const onAnimationComplete = jest.fn()
    render(
      <DiceRoller
        dieType="d6"
        modifier={0}
        label="Roll Stat"
        onAnimationComplete={onAnimationComplete}
        autoRoll={true}
      />
    )
    act(() => {
      jest.runAllTimers()
    })
    expect(onAnimationComplete).toHaveBeenCalledTimes(1)
    // Result should be between 1 and 6
    const totalEl = screen.getByTestId('dice-total')
    const total = parseInt(totalEl.textContent || '0')
    expect(total).toBeGreaterThanOrEqual(1)
    expect(total).toBeLessThanOrEqual(6)
  })
})
