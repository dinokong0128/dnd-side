import { render, screen } from '@testing-library/react'
import { InventoryPanel } from '../InventoryPanel'

const SAMPLE_ITEMS = [
  { id: 'inv-3', item_name: 'Handaxe', quantity: 5 },
  { id: 'inv-1', item_name: 'Chain Mail', quantity: 1 },
  { id: 'inv-4', item_name: 'Longsword', quantity: 1 },
  { id: 'inv-2', item_name: "Explorer's Pack", quantity: 1 },
  { id: 'inv-5', item_name: 'Shield', quantity: 1 },
]

describe('InventoryPanel', () => {
  describe('with items', () => {
    it('renders all inventory items', () => {
      render(<InventoryPanel items={SAMPLE_ITEMS} />)
      const items = screen.getAllByTestId('inventory-item')
      expect(items).toHaveLength(5)
    })

    it('displays item name and quantity for each item', () => {
      render(<InventoryPanel items={SAMPLE_ITEMS} />)
      expect(screen.getByText('Longsword')).toBeInTheDocument()
      expect(screen.getByText('×5')).toBeInTheDocument()
    })

    it('sorts items alphabetically by item_name', () => {
      render(<InventoryPanel items={SAMPLE_ITEMS} />)
      const items = screen.getAllByTestId('inventory-item')
      const names = items.map(el => el.querySelector('span')!.textContent)
      expect(names).toEqual([
        'Chain Mail',
        "Explorer's Pack",
        'Handaxe',
        'Longsword',
        'Shield',
      ])
    })

    it('shows item count badge with correct count', () => {
      render(<InventoryPanel items={SAMPLE_ITEMS} />)
      const badge = screen.getByTestId('inventory-count')
      expect(badge).toHaveTextContent('5 items')
    })

    it('shows singular "item" for single item', () => {
      render(<InventoryPanel items={[{ id: '1', item_name: 'Dagger', quantity: 1 }]} />)
      const badge = screen.getByTestId('inventory-count')
      expect(badge).toHaveTextContent('1 item')
    })

    it('shows header text "Starting Equipment"', () => {
      render(<InventoryPanel items={SAMPLE_ITEMS} />)
      expect(screen.getByText(/Starting Equipment/)).toBeInTheDocument()
    })

    it('shows subtitle text', () => {
      render(<InventoryPanel items={SAMPLE_ITEMS} />)
      expect(screen.getByText('Your gear for the adventure ahead')).toBeInTheDocument()
    })

    it('does not show empty state message', () => {
      render(<InventoryPanel items={SAMPLE_ITEMS} />)
      expect(screen.queryByTestId('inventory-empty')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty state message with backpack emoji', () => {
      render(<InventoryPanel items={[]} />)
      const emptyState = screen.getByTestId('inventory-empty')
      expect(emptyState).toBeInTheDocument()
      expect(emptyState).toHaveTextContent('🎒')
      expect(emptyState).toHaveTextContent('No items yet')
    })

    it('does not render any inventory items', () => {
      render(<InventoryPanel items={[]} />)
      expect(screen.queryAllByTestId('inventory-item')).toHaveLength(0)
    })

    it('does not show item count badge', () => {
      render(<InventoryPanel items={[]} />)
      expect(screen.queryByTestId('inventory-count')).not.toBeInTheDocument()
    })
  })
})
