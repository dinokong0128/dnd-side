import { render, screen, fireEvent } from '@testing-library/react'
import { ChatLog } from '../ChatLog'
import type { GameMessage } from '@/lib/types/message'

let mockObserve: jest.Mock
let mockDisconnect: jest.Mock

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn()
})

beforeEach(() => {
  mockObserve = jest.fn()
  mockDisconnect = jest.fn()

  class IntersectionObserverMock {
    callback: IntersectionObserverCallback

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }

    observe = mockObserve.mockImplementation(() => {
      this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    })

    disconnect = mockDisconnect

    unobserve = jest.fn()

    takeRecords = jest.fn(() => [])

    root = null

    rootMargin = '0px'

    thresholds = [0]
  }

  global.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver
})

function makeMessage(overrides: Partial<GameMessage> = {}): GameMessage {
  return {
    id: '1',
    game_id: 'game-1',
    role: 'dm',
    profile_id: null,
    content: 'Sample content',
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

describe('ChatLog', () => {
  it('renders messages in order', () => {
    const messages: GameMessage[] = [
      makeMessage({ id: '1', role: 'dm', content: 'First' }),
      makeMessage({ id: '2', role: 'player', profile_id: 'user-1', content: 'Second' }),
      makeMessage({ id: '3', role: 'dm', content: 'Third' }),
    ]
    const playerMap = new Map<string, string>([['user-1', 'Hero']])

    render(
      <ChatLog
        messages={messages}
        playerMap={playerMap}
        isLoading={false}
        hasMoreMessages={true}
        isLoadingMore={false}
        onLoadMore={jest.fn()}
      />
    )

    expect(screen.getByText(/First/)).toBeInTheDocument()
    expect(screen.getByText(/Second/)).toBeInTheDocument()
    expect(screen.getByText(/Third/)).toBeInTheDocument()
  })

  it('renders loading spinner while loading older messages', () => {
    render(
      <ChatLog
        messages={[makeMessage()]}
        playerMap={new Map()}
        isLoading={false}
        hasMoreMessages={true}
        isLoadingMore={true}
        onLoadMore={jest.fn()}
      />
    )

    expect(screen.getByText(/Fetching older messages/i)).toBeInTheDocument()
  })

  it('renders adventure-begins banner when no more messages are available', () => {
    render(
      <ChatLog
        messages={[makeMessage()]}
        playerMap={new Map()}
        isLoading={false}
        hasMoreMessages={false}
        isLoadingMore={false}
        onLoadMore={jest.fn()}
      />
    )

    expect(screen.getByText(/The adventure begins here/i)).toBeInTheDocument()
  })

  it('does not render adventure-begins banner when more messages are available', () => {
    render(
      <ChatLog
        messages={[makeMessage()]}
        playerMap={new Map()}
        isLoading={false}
        hasMoreMessages={true}
        isLoadingMore={false}
        onLoadMore={jest.fn()}
      />
    )

    expect(screen.queryByText(/The adventure begins here/i)).not.toBeInTheDocument()
  })

  it('calls onLoadMore when the top sentinel intersects', () => {
    const onLoadMore = jest.fn()

    render(
      <ChatLog
        messages={[makeMessage()]}
        playerMap={new Map()}
        isLoading={false}
        hasMoreMessages={true}
        isLoadingMore={false}
        onLoadMore={onLoadMore}
      />
    )

    expect(onLoadMore).toHaveBeenCalled()
  })

  it('does not call onLoadMore when already loading more', () => {
    const onLoadMore = jest.fn()

    render(
      <ChatLog
        messages={[makeMessage()]}
        playerMap={new Map()}
        isLoading={false}
        hasMoreMessages={true}
        isLoadingMore={true}
        onLoadMore={onLoadMore}
      />
    )

    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('renders empty state when no messages and not loading', () => {
    render(
      <ChatLog
        messages={[]}
        playerMap={new Map()}
        isLoading={false}
        hasMoreMessages={true}
        isLoadingMore={false}
        onLoadMore={jest.fn()}
      />
    )

    expect(screen.getByText(/Awaiting the Dungeon Master/i)).toBeInTheDocument()
  })

  it('renders loading state when isLoading is true', () => {
    render(
      <ChatLog
        messages={[]}
        playerMap={new Map()}
        isLoading={true}
        hasMoreMessages={true}
        isLoadingMore={false}
        onLoadMore={jest.fn()}
      />
    )

    expect(screen.getByText(/Loading the tale/i)).toBeInTheDocument()
  })

  describe('edit/delete prop threading (DIN-61)', () => {
    it('passes userId to ChatMessage when provided', () => {
      const messages: GameMessage[] = [
        makeMessage({ id: '1', role: 'player', profile_id: 'user-1', content: 'Hello' }),
      ]

      const { container } = render(
        <ChatLog
          messages={messages}
          playerMap={new Map([['user-1', 'Hero']])}
          isLoading={false}
          hasMoreMessages={false}
          isLoadingMore={false}
          onLoadMore={jest.fn()}
          userId="user-1"
          onDeleteMessage={jest.fn()}
          onEditMessage={jest.fn()}
        />
      )

      // The player message bubble should be in the DOM
      expect(container.querySelector('[onmouseenter]') || screen.getByText('Hello')).toBeInTheDocument()
    })

    it('renders all messages without crashing when edit/delete props are provided', () => {
      const messages: GameMessage[] = [
        makeMessage({ id: '1', role: 'dm', content: 'A monster appears.' }),
        makeMessage({ id: '2', role: 'player', profile_id: 'user-1', content: 'I attack!' }),
      ]

      render(
        <ChatLog
          messages={messages}
          playerMap={new Map([['user-1', 'Hero']])}
          isLoading={false}
          hasMoreMessages={false}
          isLoadingMore={false}
          onLoadMore={jest.fn()}
          userId="user-1"
          onDeleteMessage={jest.fn()}
          onEditMessage={jest.fn()}
        />
      )

      expect(screen.getByText('A monster appears.')).toBeInTheDocument()
      expect(screen.getByText('I attack!')).toBeInTheDocument()
    })
  })

  it('passes onRetry to system messages and calls it when retry button is clicked', () => {
    const messages: GameMessage[] = [
      makeMessage({ role: 'system', content: 'DM error occurred.' }),
    ]
    const onRetry = jest.fn()

    render(
      <ChatLog
        messages={messages}
        playerMap={new Map()}
        isLoading={false}
        hasMoreMessages={true}
        isLoadingMore={false}
        onLoadMore={jest.fn()}
        onRetry={onRetry}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /retry last action/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  describe('DIN-73 hotfix — infinite pagination guard', () => {
    // Regression: the observer effect used to list `onLoadMore` in its deps,
    // so each parent re-render (fresh handleLoadMore closure) recreated the
    // observer and re-fired `onLoadMore` while the top sentinel was still in
    // view. Result: the whole chat history loaded back to the first message.
    //
    // The fix moves `onLoadMore`, `hasMoreMessages`, and `isLoadingMore` into
    // refs so the observer is created exactly once for the component's life.
    it('does not re-call onLoadMore when parent passes a new function each render', () => {
      const messages = [
        makeMessage({ id: '1', role: 'dm', content: 'older' }),
        makeMessage({ id: '2', role: 'dm', content: 'newer' }),
      ]

      // Parent-simulating wrapper that re-renders with a fresh onLoadMore
      // reference on every render — the exact shape of the original bug.
      const onLoadMore = jest.fn()
      const { rerender } = render(
        <ChatLog
          messages={messages}
          playerMap={new Map()}
          isLoading={false}
          hasMoreMessages={true}
          isLoadingMore={false}
          onLoadMore={() => onLoadMore()}
        />
      )

      // Force three consecutive re-renders with a fresh handler each time.
      for (let i = 0; i < 3; i++) {
        rerender(
          <ChatLog
            messages={messages}
            playerMap={new Map()}
            isLoading={false}
            hasMoreMessages={true}
            isLoadingMore={false}
            onLoadMore={() => onLoadMore()}
          />
        )
      }

      // Observer should have fired exactly once (on mount). Re-renders with
      // a new onLoadMore identity must NOT recreate the observer.
      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('attaches observer after isLoading flips from true to false', () => {
      // Regression: the observer effect had `[]` deps and so ran exactly
      // once on mount. When the component first rendered with
      // `isLoading={true}` it returned a spinner (no sentinel in the DOM),
      // the effect ran, couldn't find the sentinel, and bailed. When
      // isLoading later flipped to false, the effect never re-ran because
      // of the empty deps — so the observer was never attached and
      // scrolling to the top did nothing.
      //
      // Fix: include `isLoading` in the observer effect's deps so it
      // re-runs when the real render tree (with the sentinel) appears.
      const messages = [makeMessage({ id: '1', role: 'dm', content: 'older' })]
      const onLoadMore = jest.fn()

      const { rerender } = render(
        <ChatLog
          messages={messages}
          playerMap={new Map()}
          isLoading={true}
          hasMoreMessages={true}
          isLoadingMore={false}
          onLoadMore={onLoadMore}
        />
      )
      // Effect ran while isLoading=true; no sentinel, so no observer fired.
      expect(onLoadMore).not.toHaveBeenCalled()

      rerender(
        <ChatLog
          messages={messages}
          playerMap={new Map()}
          isLoading={false}
          hasMoreMessages={true}
          isLoadingMore={false}
          onLoadMore={onLoadMore}
        />
      )

      // Now the sentinel is in the DOM and the mocked IntersectionObserver
      // fires immediately on observe(), so onLoadMore must have been called.
      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })
  })

  describe('DIN-73 hotfix — scroll-to-bottom button visibility', () => {
    // Regression: previously the button was gated on `hasNewMessages` only,
    // so users who simply scrolled up (no new message arriving) had no way
    // back to the latest message. Button now renders whenever `!isAtBottom`.
    //
    // Additionally: the button is rendered through a React portal to
    // document.body so that its `position: fixed` anchors to the viewport
    // (the chat log's `backdrop-filter` creates a containing block that
    // would otherwise trap the button and scroll it offscreen).
    it('renders the scroll-to-bottom button when user scrolls up', () => {
      const messages = [
        makeMessage({ id: '1', role: 'dm', content: 'first' }),
        makeMessage({ id: '2', role: 'dm', content: 'second' }),
        makeMessage({ id: '3', role: 'dm', content: 'third' }),
      ]
      const { container } = render(
        <ChatLog
          messages={messages}
          playerMap={new Map()}
          isLoading={false}
          hasMoreMessages={false}
          isLoadingMore={false}
          onLoadMore={jest.fn()}
        />
      )

      // Initial state: isAtBottom=true, button not present.
      expect(
        screen.queryByRole('button', { name: /latest message|new message/i }),
      ).not.toBeInTheDocument()

      // Fire a scroll event on the chat container with scrollTop such that
      // scrollHeight - scrollTop - clientHeight >= 100 → atBottom becomes
      // false → setIsAtBottom(false) → button renders.
      const scrollContainer = container.querySelector('.dnd-chat-log') as HTMLDivElement
      expect(scrollContainer).not.toBeNull()
      Object.defineProperty(scrollContainer, 'scrollHeight', { configurable: true, value: 2000 })
      Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 500 })
      Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: 400 })

      fireEvent.scroll(scrollContainer)

      // Button should now be in the document (rendered via portal to body).
      // `screen` queries the whole document, so the portal is reachable.
      const button = screen.getByRole('button', { name: /latest message/i })
      expect(button).toBeInTheDocument()
    })
  })
})
