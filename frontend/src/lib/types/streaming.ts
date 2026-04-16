// Streaming DM response types (DIN-66)
//
// The backend streams SSE events in three shapes:
//   - chunk: narrative text fragment to append
//   - block: complete structured XML tag (dice_rolls, event, suggested_actions,
//            state_changes)
//   - done:  terminal marker — subscribers close the stream
//
// The frontend builds a list of StreamSegments from chunk/block events so the
// live DM bubble can interleave plain text with complete dice_rolls blocks.

export type StreamSegment =
  | { kind: 'text'; content: string }
  | { kind: 'dice_rolls'; content: string }

export type SseEvent =
  | { type: 'chunk'; text: string }
  | {
      type: 'block'
      tag: string
      attributes: Record<string, string>
      content: string
    }
  | { type: 'done' }

/**
 * Append a text chunk to a segment list. If the last segment is text,
 * append to its content; otherwise start a new text segment. Pure function —
 * never mutates the input array.
 */
export function appendTextChunk(
  segments: StreamSegment[],
  text: string
): StreamSegment[] {
  if (!text) return segments
  const last = segments[segments.length - 1]
  if (last && last.kind === 'text') {
    return [
      ...segments.slice(0, -1),
      { kind: 'text', content: last.content + text },
    ]
  }
  return [...segments, { kind: 'text', content: text }]
}
