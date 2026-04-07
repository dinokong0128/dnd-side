'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GameMessage } from '@/lib/types/message'
import { Game } from '@/lib/supabase/games'
import { GameHeader } from './GameHeader'
import { ChatLog } from './ChatLog'
import { ChatInput } from './ChatInput'
import { TypingIndicator } from './TypingIndicator'

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

  // Initialize: fetch messages and players, set up subscriptions
  useEffect(() => {
    const supabase = createClient()

    const initializeSession = async () => {
      try {
        // Fetch all game messages
        const { data: messagesData } = await supabase
          .from('game_messages')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: true })

        const msgs = (messagesData || []) as GameMessage[]
        setMessages(msgs)

        // Fetch all players for this game
        const { data: playersData } = await supabase
          .from('players')
          .select('id, profile_id, character_name')
          .eq('game_id', gameId)

        // Build playerMap (profile_id -> character_name)
        const map = new Map<string, string>()
        ;(playersData || []).forEach((p: any) => {
          if (p.profile_id && p.character_name) {
            map.set(p.profile_id, p.character_name)
          }
        })
        setPlayerMap(map)

        // Determine if waiting for DM
        if (msgs.length === 0) {
          setIsWaitingForDm(true)
        } else {
          const lastMsg = msgs[msgs.length - 1]
          setIsWaitingForDm(lastMsg.role === 'player')
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Failed to initialize session:', error)
        setIsLoading(false)
      }
    }

    initializeSession()

    // Subscribe to game_messages INSERT events
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
          setMessages((prev) => [...prev, newMsg])

          // If DM responded, we're no longer waiting
          if (newMsg.role === 'dm') {
            setIsWaitingForDm(false)
          } else if (newMsg.role === 'player') {
            setIsWaitingForDm(true)
          }
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
        }
      )
      .subscribe()

    return () => {
      messagesSubscription.unsubscribe()
      gamesSubscription.unsubscribe()
    }
  }, [gameId])

  return (
    <div className="dnd-page-bg flex flex-col h-screen">
      <GameHeader gameName={game.name} gameStatus={gameStatus} />
      <ChatLog messages={messages} playerMap={playerMap} isLoading={isLoading} />
      {isWaitingForDm && <TypingIndicator />}
      <ChatInput gameStatus={gameStatus} isWaitingForDm={isWaitingForDm} />
    </div>
  )
}
