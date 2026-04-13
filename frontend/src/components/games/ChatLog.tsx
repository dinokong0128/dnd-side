'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GameMessage } from '@/lib/types/message'
import { ChatMessage } from './ChatMessage'

interface ChatLogProps {
  messages: GameMessage[]
  playerMap: Map<string, string>
  isLoading: boolean
  hasMoreMessages: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onRetry?: () => void
}

export function ChatLog({
  messages,
  playerMap,
  isLoading,
  hasMoreMessages,
  isLoadingMore,
  onLoadMore,
  onRetry,
}: ChatLogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  // isAtBottom doesn't need to be state since it doesn't drive rendering directly.
  // Using a ref avoids calling setState inside an effect when new messages arrive.
  const isAtBottomRef = useRef(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)

  useLayoutEffect(() => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const newScrollHeight = container.scrollHeight
    const prevScrollHeight = prevScrollHeightRef.current

    if (prevScrollHeight > 0 && newScrollHeight > prevScrollHeight) {
      container.scrollTop += newScrollHeight - prevScrollHeight
    }

    prevScrollHeightRef.current = 0
  }, [messages])

  useEffect(() => {
    const sentinel = topSentinelRef.current
    const root = scrollContainerRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMoreMessages && !isLoadingMore) {
          if (scrollContainerRef.current) {
            prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight
          }
          onLoadMore()
        }
      },
      {
        root,
        rootMargin: '100px',
        threshold: 0,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMoreMessages, isLoadingMore, onLoadMore])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottomRef.current && bottomSentinelRef.current) {
      bottomSentinelRef.current.scrollIntoView({ behavior: 'smooth' })
    } else if (!isAtBottomRef.current) {
      // Intentional: notify user of new content when scrolled away.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasNewMessages(true)
    }
  }, [messages])

  // Handle scroll to detect if at bottom
  const handleScroll = () => {
    if (!scrollContainerRef.current) return

    const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 100

    isAtBottomRef.current = atBottom
    if (atBottom) {
      setHasNewMessages(false)
    }
  }

  // Scroll to bottom when user clicks
  const scrollToBottom = () => {
    if (bottomSentinelRef.current) {
      bottomSentinelRef.current.scrollIntoView({ behavior: 'smooth' })
      isAtBottomRef.current = true
      setHasNewMessages(false)
    }
  }

  if (isLoading) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ background: 'var(--dnd-black)' }}
      >
        <div className="text-center">
          <div
            className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid"
            style={{
              borderColor: 'var(--dnd-gold)',
              borderRightColor: 'transparent',
            }}
          />
          <p
            className="font-serif italic"
            style={{ color: 'var(--dnd-parchment-dim)' }}
          >
            Loading the tale...
          </p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ background: 'var(--dnd-black)' }}
      >
        <div className="text-center">
          <p
            className="font-serif text-lg italic"
            style={{ color: 'var(--dnd-parchment-dim)' }}
          >
            Awaiting the Dungeon Master — The world is being woven…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="relative flex flex-1 flex-col overflow-y-auto px-6 py-4"
      style={{ background: 'var(--dnd-black)' }}
    >
      <div className="max-w-3xl space-y-4">
        <div ref={topSentinelRef} />

        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-2">
            <div
              className="h-4 w-4 rounded-full"
              style={{
                border: '2px solid rgba(201,168,76,0.2)',
                borderTopColor: 'var(--dnd-gold)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span
              className="text-xs italic"
              style={{
                fontFamily: "'Lora', serif",
                color: 'var(--dnd-parchment-dim)',
              }}
            >
              Fetching older messages…
            </span>
          </div>
        )}

        {!hasMoreMessages && !isLoadingMore && messages.length > 0 && (
          <div className="flex flex-col items-center gap-2 pb-1 pt-3">
            <div
              className="h-px w-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--dnd-brown), transparent)',
              }}
            />
            <div
              className="flex items-center gap-2.5 uppercase"
              style={{
                color: 'var(--dnd-gold-dim)',
                fontFamily: "'Cinzel', serif",
                fontSize: '10px',
                letterSpacing: '0.15em',
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rotate-45"
                style={{ background: 'var(--dnd-gold-dim)' }}
              />
              <span>⚔ The adventure begins here</span>
              <span
                className="inline-block h-1.5 w-1.5 rotate-45"
                style={{ background: 'var(--dnd-gold-dim)' }}
              />
            </div>
            <div
              className="h-px w-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--dnd-brown), transparent)',
              }}
            />
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            characterName={
              msg.role === 'player'
                ? playerMap.get(msg.profile_id || '') || 'Unknown Character'
                : undefined
            }
            content={msg.content}
            onRetry={msg.role === 'system' ? onRetry : undefined}
          />
        ))}
      </div>

      <div ref={bottomSentinelRef} />

      {/* New message indicator */}
      {hasNewMessages && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 transform rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-lg"
          style={{
            background: 'var(--dnd-charcoal)',
            borderColor: 'var(--dnd-gold)',
            color: 'var(--dnd-gold)',
          }}
        >
          ↓ New message
        </button>
      )}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
