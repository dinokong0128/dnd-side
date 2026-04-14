import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

const generateTextSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('game_name') }),
  z.object({ type: z.literal('dm_persona') }),
  z.object({
    type: z.literal('character_name'),
    race: z.string().optional(),
    characterClass: z.string().optional(),
  }),
])

function buildPrompt(
  input: z.infer<typeof generateTextSchema>
): { system: string; maxTokens: number } {
  switch (input.type) {
    case 'game_name':
      return {
        system:
          'Generate a single evocative D&D campaign name. Fantasy setting. 2–5 words. Return only the name, nothing else.',
        maxTokens: 30,
      }
    case 'dm_persona':
      return {
        system:
          'Generate a single DM persona / campaign tone description for a D&D 5e campaign. 1–2 vivid, specific sentences. Return only the description, nothing else.',
        maxTokens: 150,
      }
    case 'character_name': {
      const race = input.race || 'Human'
      const characterClass = input.characterClass || 'Fighter'
      return {
        system: `Generate a single fantasy D&D character name appropriate for a ${race} ${characterClass}. Return only the name, nothing else.`,
        maxTokens: 20,
      }
    }
  }
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

    const body = await request.json()
    const parsed = generateTextSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }

    const { system, maxTokens } = buildPrompt(parsed.data)

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: 'Generate.' }],
    })

    const suggestion = (response.content[0] as { text: string }).text.trim()

    return NextResponse.json({ suggestion }, { status: 200 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
