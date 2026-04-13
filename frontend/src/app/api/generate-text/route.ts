/** @jest-environment node */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('game_name') }),
  z.object({ type: z.literal('dm_persona') }),
  z.object({
    type: z.literal('character_name'),
    race: z.string().optional(),
    characterClass: z.string().optional(),
  }),
])

const PROMPTS: Record<string, (args: { race?: string; characterClass?: string }) => { prompt: string; maxTokens: number }> = {
  game_name: () => ({
    prompt:
      'Generate a single evocative D&D campaign name. Fantasy setting. 2–5 words. Return only the name, nothing else.',
    maxTokens: 30,
  }),
  dm_persona: () => ({
    prompt:
      'Generate a single DM persona / campaign tone description for a D&D 5e campaign. 1–2 vivid, specific sentences. Return only the description, nothing else.',
    maxTokens: 150,
  }),
  character_name: ({ race, characterClass }) => ({
    prompt: `Generate a single fantasy D&D character name appropriate for a ${race ?? 'Human'} ${characterClass ?? 'Fighter'}. Return only the name, nothing else.`,
    maxTokens: 20,
  }),
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const data = parsed.data
    const args =
      data.type === 'character_name'
        ? { race: data.race, characterClass: data.characterClass }
        : {}
    const { prompt, maxTokens } = PROMPTS[data.type](args)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const suggestion = (message.content[0] as { text: string }).text.trim()
    return NextResponse.json({ suggestion })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
