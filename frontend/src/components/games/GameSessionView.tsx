'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GameMessage } from '@/lib/types/message'
import {
  type StreamSegment,
  type SseEvent,
  appendTextChunk,
} from '@/lib/types/streaming'
import { Game } from '@/lib/supabase/games'
import { GameHeader } from './GameHeader'
import { ChatLog } from './ChatLog'
import { ChatInput } from './ChatInput'
import { TypingIndicator } from './TypingIndicator'
import { ConfirmModal } from './ConfirmModal'
import { SessionStatusBanner } from './SessionStatusBanner'
import { CharacterSheetPanel } from './CharacterSheetPanel'
import { LevelUpModal } from './LevelUpModal'
import type { LevelUpPayload } from './LevelUpModal'
import type { PlayerRow } from '@/lib/types/player'
import { CHAT_PAGE_SIZE } from '@/lib/constants/game'

interface GameSessionViewProps {
  gameId: string
  game: Game
  userId: string
}

export function GameSessionView({
  gameId,
  game,
  userId,
}: GameSessionViewProps) {
  const [messages, setMessages] = useState<GameMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWaitingForDm, setIsWaitingForDm] = useState(false)
  const [gameStatus, setGameStatus] = useState(game.status)
  const [playerMap, setPlayerMap] = useState<Map<string, string>>(new Map())
  const [hasCharacter, setHasCharacter] = useState(false)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [showRetryTimeout, setShowRetryTimeout] = useState(false)
  const [lastPlayerAction, setLastPlayerAction] = useState<string | null>(null)
  const [suggestedActions, setSuggestedActions] = useState<string[]>(
    game.suggested_actions ?? []
  )
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showCharacterSheet, setShowCharacterSheet] = useState(false)
  const [levelUpPayload, setLevelUpPayload] = useState<LevelUpPayload | null>(null)
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [currentPlayerRow, setCurrentPlayerRow] = useState<PlayerRow | null>(null)
  // DIN-66 live DM bubble. null = no active stream; non-null = bubble rendered
  // below the chat list until Realtime DM INSERT reconciles (clears to null).
  const [streamingSegments, setStreamingSegments] =
    useState<StreamSegment[] | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // DIN-66 fallback: if Supabase Realtime INSERT is delayed after stream
  // completion, force-clear streaming state after 3s to unblock the input.
  const realtimeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isHost = game.created_by === userId

  // Initialize: fetch messages and players, set up subscriptions
  useEffect(() => {
    const supabase = createClient()

    const initializeSession = async () => {
      try {
        const messagesPromise = supabase
          .from('game_messages')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: false })
          .limit(CHAT_PAGE_SIZE)

        const latestMessagePromise = supabase
          .from('game_messages')
          .select('role')
          .eq('game_id', gameId)
          .order('created_at', { ascending: false })
          .limit(1)

        // Fetch all players for this game
        const playersPromise = supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)

        const [{ data: messagesData }, { data: latestData }, { data: playersData }] =
          await Promise.all([messagesPromise, latestMessagePromise, playersPromise])

        const msgs = ((messagesData || []) as GameMessage[]).reverse()
        setMessages(msgs)

        if (msgs.length < CHAT_PAGE_SIZE) {
          setHasMoreMessages(false)
        }
        if (msgs.length > 0) {
          setOldestCreatedAt(msgs[0].created_at)
        }

        // Build playerMap (profile_id -> character_name)
        const map = new Map<string, string>()
        const players = (playersData ?? []) as PlayerRow[]
        players.forEach((p) => {
          if (p.profile_id && p.character_name) {
            map.set(p.profile_id, p.character_name)
          }
        })
        setPlayerMap(map)

        // Track current user's player ID and full row for the character sheet / level-up modal
        const myPlayer = players.find((p) => p.profile_id === userId)
        setCurrentPlayerId(myPlayer ? myPlayer.id : null)
        setCurrentPlayerRow(myPlayer ?? null)

        // Check if current user has a character in this game
        setHasCharacter(map.has(userId))

        const latestMsg = latestData?.[0]
        if (!latestMsg) {
          setIsWaitingForDm(true)
        } else {
          setIsWaitingForDm(latestMsg.role === 'player')
        }

        // Authenticate Realtime WebSocket with the user's JWT so RLS-protected
        // postgres_changes events are delivered. Without this, @supabase/ssr's
        // browser client connects Realtime as anonymous and INSERT/UPDATE/DELETE
        // events are silently blocked by the game_messages SELECT policy.
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token)
        }

        setIsLoading(false)
      } catch {
        setIsLoading(false)
      }
    }

    initializeSession()

    // Subscribe to game_messages INSERT/DELETE/UPDATE events
    const messagesSubscription = supabase
      .channel(`game_messages:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMsg = payload.new as GameMessage

          if (newMsg.role === 'player') {
            // Reconcile: replace any optimistic message matching this player+content
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) =>
                  !(
                    m.id.startsWith('optimistic-') &&
                    m.profile_id === newMsg.profile_id &&
                    m.content === newMsg.content
                  )
              )
              return [...filtered, newMsg]
            })
            setIsWaitingForDm(true)
          } else {
            setMessages((prev) => [...prev, newMsg])
            // If DM or system (error) responded, we're no longer waiting
            if (newMsg.role === 'dm' || newMsg.role === 'system') {
              setIsWaitingForDm(false)
              // DIN-66: reconcile — swap the live streaming bubble for the
              // persisted DM message in a single render (no flash).
              setStreamingSegments(null)
              // Realtime arrived — cancel the stuck-input fallback timer.
              if (realtimeFallbackRef.current) {
                clearTimeout(realtimeFallbackRef.current)
                realtimeFallbackRef.current = null
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'game_messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const deletedId = payload.old ? (payload.old as { id?: string }).id : undefined
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as GameMessage
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          )
        }
      )
      .subscribe()

    // Subscribe to games UPDATE events for status changes
    const gamesSubscription = supabase
      .channel(`games:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new as Game
          setGameStatus(updatedGame.status)
          setSuggestedActions(updatedGame.suggested_actions ?? [])
        }
      )
      .subscribe()

    // Subscribe to level_up_available broadcast events
    const levelUpSubscription = supabase
      .channel(`game:${gameId}`)
      .on('broadcast', { event: 'level_up_available' }, ({ payload }) => {
        setLevelUpPayload(payload as LevelUpPayload)
      })
      .subscribe()

    return () => {
      messagesSubscription?.unsubscribe()
      gamesSubscription?.unsubscribe()
      levelUpSubscription?.unsubscribe()
      if (realtimeFallbackRef.current) clearTimeout(realtimeFallbackRef.current)
    }
  }, [gameId, userId])

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreMessages || !oldestCreatedAt) return

    setIsLoadingMore(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('game_messages')
        .select('*')
        .eq('game_id', gameId)
        .lt('created_at', oldestCreatedAt)
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE)

      const older = ((data || []) as GameMessage[]).reverse()
      if (older.length === 0) {
        setHasMoreMessages(false)
        return
      }

      setMessages((prev) => [...older, ...prev])
      setOldestCreatedAt(older[0].created_at)
      if (older.length < CHAT_PAGE_SIZE) {
        setHasMoreMessages(false)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }

  // E2E testing: listen for custom DOM events that simulate Supabase Realtime
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_TESTING !== 'true') return

    const addMessage = (event: Event) => {
      const detail = (event as CustomEvent).detail
      const msg: GameMessage = {
        id: detail.id || `e2e-${Date.now()}`,
        game_id: detail.game_id || gameId,
        role: detail.role,
        profile_id: detail.profile_id ?? null,
        content: detail.content,
        created_at: detail.created_at || new Date().toISOString(),
        dice_rolls: detail.dice_rolls ?? null,
      }
      if (msg.role === 'player') {
        // Reconcile: mirror the Realtime INSERT handler — remove any optimistic
        // message with a matching profile_id + content before adding the real one.
        setMessages((prev) => {
          const filtered = prev.filter(
            (m) =>
              !(
                m.id.startsWith('optimistic-') &&
                m.profile_id === msg.profile_id &&
                m.content === msg.content
              )
          )
          return [...filtered, msg]
        })
        setIsWaitingForDm(true)
      } else {
        setMessages((prev) => [...prev, msg])
        if (msg.role === 'dm' || msg.role === 'system') {
          setIsWaitingForDm(false)
          setStreamingSegments(null)
        }
      }
    }

    const handleOpeningNarration = () => {
      setIsWaitingForDm(true)
    }
    const handleSessionPaused = () => setGameStatus('paused')
    const handleSessionEnded = () => setGameStatus('ended')
    const handleLevelUpAvailable = (event: Event) => {
      const detail = (event as CustomEvent).detail as LevelUpPayload
      setLevelUpPayload(detail)
    }

    window.addEventListener('player-message', addMessage)
    window.addEventListener('dm-message', addMessage)
    window.addEventListener('system-message', addMessage)
    window.addEventListener('opening-narration', handleOpeningNarration)
    window.addEventListener('session-paused', handleSessionPaused)
    window.addEventListener('session-ended', handleSessionEnded)
    window.addEventListener('level-up-available', handleLevelUpAvailable)

    return () => {
      window.removeEventListener('player-message', addMessage)
      window.removeEventListener('dm-message', addMessage)
      window.removeEventListener('system-message', addMessage)
      window.removeEventListener('opening-narration', handleOpeningNarration)
      window.removeEventListener('session-paused', handleSessionPaused)
      window.removeEventListener('session-ended', handleSessionEnded)
      window.removeEventListener('level-up-available', handleLevelUpAvailable)
    }
  }, [gameId])

  // Track the last player action for retry
  useEffect(() => {
    const last = [...messages].reverse().find(
      (m) => m.role === 'player' && m.profile_id === userId
    )
    if (last) setLastPlayerAction(last.content)
  }, [messages, userId])

  // Start/clear 45s timeout when waiting state changes — only during active sessions.
  // Paused/lobby states should never surface a retry CTA since /actions would 500.
  useEffect(() => {
    if (isWaitingForDm && gameStatus === 'active') {
      retryTimerRef.current = setTimeout(() => setShowRetryTimeout(true), 45_000)
    } else {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
      setShowRetryTimeout(false)
    }
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [isWaitingForDm, gameStatus])

  const handleSubmit = async (actionText: string) => {
    setShowRetryTimeout(false)

    // 1. Optimistic player message (DIN-64) — unchanged.
    const optimisticMsg: GameMessage = {
      id: `optimistic-${crypto.randomUUID()}`,
      game_id: gameId,
      role: 'player',
      profile_id: userId,
      content: actionText,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setIsWaitingForDm(true)

    // 2. Submit action — backend returns 202 quickly and spawns the
    //    background streaming coroutine that publishes to Redis pub/sub.
    let actionResponse: Response
    try {
      actionResponse = await fetch(`/api/games/${gameId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_text: actionText }),
      })
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setIsWaitingForDm(false)
      return
    }

    if (!actionResponse.ok) {
      let errorDetail: string | undefined
      try {
        errorDetail = (await actionResponse.json()).error
      } catch {
        // fall through
      }
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setIsWaitingForDm(false)
      if (errorDetail) console.error('Action failed:', errorDetail)
      return
    }

    // 3. Open SSE stream — bubble appears; tokens will stream in.
    setStreamingSegments([])

    let eventsResponse: Response
    try {
      eventsResponse = await fetch(`/api/games/${gameId}/events`)
    } catch {
      setStreamingSegments(null)
      return
    }

    if (!eventsResponse.ok || !eventsResponse.body) {
      setStreamingSegments(null)
      return
    }

    const reader = eventsResponse.body.getReader()
    const decoder = new TextDecoder()
    let sseBuffer = ''

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })

        // SSE events are delimited by \n\n. Buffer partial frames across reads.
        let sepIdx: number
        while ((sepIdx = sseBuffer.indexOf('\n\n')) !== -1) {
          const frame = sseBuffer.slice(0, sepIdx)
          sseBuffer = sseBuffer.slice(sepIdx + 2)

          for (const line of frame.split('\n')) {
            if (!line.startsWith('data: ')) continue
            let event: SseEvent
            try {
              event = JSON.parse(line.slice(6)) as SseEvent
            } catch {
              continue
            }

            if (event.type === 'chunk') {
              setStreamingSegments((prev) =>
                appendTextChunk(prev ?? [], event.text)
              )
            } else if (event.type === 'block') {
              if (event.tag === 'dice_rolls') {
                setStreamingSegments((prev) => [
                  ...(prev ?? []),
                  { kind: 'dice_rolls', content: event.content },
                ])
              } else if (event.tag === 'suggested_actions') {
                const lines = event.content
                  .trim()
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                setSuggestedActions(lines)
              }
              // 'event' and 'state_changes' consumed silently.
            } else if (event.type === 'done') {
              // Realtime INSERT fires shortly after done is published.
              // Set a 3s fallback to unblock the input if Realtime is delayed.
              if (realtimeFallbackRef.current) clearTimeout(realtimeFallbackRef.current)
              realtimeFallbackRef.current = setTimeout(() => {
                setIsWaitingForDm(false)
                setStreamingSegments(null)
              }, 3000)
            }
        }
      }
    } catch {
      // Network hiccup mid-stream: clear the bubble. The Realtime system
      // message inserted by the backend (on stream failure) surfaces retry.
      setStreamingSegments(null)
    }
  }

  const handleRetryLastAction = async () => {
    if (!lastPlayerAction) return
    setShowRetryTimeout(false)
    await handleSubmit(lastPlayerAction)
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/games/${gameId}/messages/${messageId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Delete message failed:', errorData.error)
      }
      // Removal arrives via Realtime DELETE subscription
    } catch {
      console.error('Delete message request failed')
    }
  }

  const handleEditMessage = async (messageId: string, content: string) => {
    setIsWaitingForDm(true)
    try {
      const response = await fetch(`/api/games/${gameId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Edit message failed:', errorData.error)
        setIsWaitingForDm(false)
      }
      // Update arrives via Realtime UPDATE subscription
      // DM response arrives via Realtime INSERT subscription
    } catch {
      setIsWaitingForDm(false)
      console.error('Edit message request failed')
    }
  }

  const handlePause = async () => {
    setIsActionLoading(true)
    try {
      const response = await fetch(`/api/games/${gameId}/pause`, { method: 'POST' })
      if (!response.ok) {
        const err = await response.json()
        console.error('Pause failed:', err.error)
      }
      // Status change arrives via Realtime subscription — no manual state update needed
    } catch {
      console.error('Pause request failed')
    } finally {
      setIsActionLoading(false)
      setShowPauseModal(false)
    }
  }

  const handleEnd = async () => {
    setIsActionLoading(true)
    try {
      const response = await fetch(`/api/games/${gameId}/end`, { method: 'POST' })
      if (!response.ok) {
        const err = await response.json()
        console.error('End failed:', err.error)
      }
    } catch {
      console.error('End request failed')
    } finally {
      setIsActionLoading(false)
      setShowEndModal(false)
    }
  }

  const handleResume = async () => {
    setIsWaitingForDm(true)
    try {
      const response = await fetch(`/api/games/${gameId}/resume`, { method: 'POST' })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Resume failed')
      }
      // Status change (paused → active) arrives via Realtime games subscription
      // Resume narration arrives via Realtime game_messages subscription
      // isWaitingForDm will be cleared when the DM message arrives
      if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
        setGameStatus('active')
      }
    } catch (error) {
      console.error('Resume failed:', error)
      setIsWaitingForDm(false)
      throw error // Re-throw so SessionStatusBanner can reset its loading state
    }
  }

  return (
    <div className="dnd-page-bg flex flex-col h-screen" data-player-id={currentPlayerId ?? ''}>
      <GameHeader
        gameName={game.name}
        gameStatus={gameStatus}
        isHost={isHost}
        onPause={() => setShowPauseModal(true)}
        onEnd={() => setShowEndModal(true)}
        onToggleSheet={currentPlayerId ? () => setShowCharacterSheet((s) => !s) : undefined}
      />
      {/* Main content row: chat column + optional character sheet panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat column — shrinks to make room for the sheet panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatLog
            messages={messages}
            playerMap={playerMap}
            isLoading={isLoading}
            hasMoreMessages={hasMoreMessages}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            onRetry={handleRetryLastAction}
            userId={userId}
            isWaitingForDm={isWaitingForDm}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            streamingSegments={streamingSegments}
          />
          {isWaitingForDm &&
            gameStatus === 'active' &&
            streamingSegments === null && <TypingIndicator />}
          {showRetryTimeout && isWaitingForDm && gameStatus === 'active' && (
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--dnd-brown)', background: 'var(--dnd-charcoal)', padding: '8px 24px' }}>
              <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderRadius: '6px', border: '1px solid rgba(192,57,43,0.3)', background: 'rgba(139,34,50,0.12)', padding: '8px 14px' }}>
                <span style={{ fontFamily: "'Lora', serif", fontSize: '0.85rem', fontStyle: 'italic', color: '#e8a0a0' }}>
                  The Dungeon Master hasn&apos;t responded in a while.
                </span>
                <button onClick={handleRetryLastAction} className="dnd-btn-secondary" style={{ whiteSpace: 'nowrap', padding: '4px 12px', fontSize: '0.65rem' }}>
                  ↩ Retry
                </button>
              </div>
            </div>
          )}
          <SessionStatusBanner
            gameStatus={gameStatus}
            isHost={isHost}
            onResume={handleResume}
            onEnd={() => setShowEndModal(true)}
          />
          {/* Level-up toast banner — persists until confirmed or dismissed */}
          {levelUpPayload && !showLevelUpModal && (
            <div
              data-testid="level-up-toast"
              style={{
                flexShrink: 0,
                borderTop: '1px solid rgba(201,168,76,0.4)',
                background: 'rgba(201,168,76,0.12)',
                padding: '8px 24px',
              }}
            >
              <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', color: 'var(--dnd-gold, #c9a84c)', letterSpacing: '0.06em' }}>
                    Level Up Available!
                  </span>
                  <p style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--dnd-parchment-dim, #8a7a60)', margin: '2px 0 0 0' }}>
                    You&apos;ve reached Level {levelUpPayload.new_level}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setShowLevelUpModal(true)}
                    className="dnd-btn"
                    style={{ padding: '5px 14px', fontSize: '0.65rem' }}
                  >
                    Level Up
                  </button>
                  <button
                    onClick={() => setLevelUpPayload(null)}
                    className="dnd-btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.65rem' }}
                    aria-label="Dismiss level up"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}
          <ChatInput
            gameStatus={gameStatus}
            isWaitingForDm={isWaitingForDm}
            hasCharacter={hasCharacter}
            onSubmit={handleSubmit}
            suggestedActions={suggestedActions}
          />
        </div>

        {/* Character sheet panel — sits alongside the chat column */}
        {showCharacterSheet && currentPlayerId && (
          <CharacterSheetPanel
            playerId={currentPlayerId}
            onClose={() => setShowCharacterSheet(false)}
          />
        )}
      </div>

      {/* Level-up modal */}
      {showLevelUpModal && levelUpPayload && currentPlayerRow && (
        <LevelUpModal
          gameId={gameId}
          payload={levelUpPayload}
          player={currentPlayerRow}
          onClose={() => setShowLevelUpModal(false)}
          onConfirmed={() => {
            setShowLevelUpModal(false)
            setLevelUpPayload(null)
          }}
        />
      )}

      <ConfirmModal
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        onConfirm={handlePause}
        title="Pause the Adventure?"
        body="The session will be paused. Players can rejoin later when you resume."
        confirmLabel="Pause Session"
        variant="default"
        isLoading={isActionLoading}
      />
      <ConfirmModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onConfirm={handleEnd}
        title="End This Adventure Forever?"
        body="This cannot be undone. The session will be permanently closed and can never be resumed."
        confirmLabel="End Session Forever"
        variant="destructive"
        isLoading={isActionLoading}
      />
    </div>
  )
}

