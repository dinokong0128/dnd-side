/** Split content into display paragraphs using the same rule as the streaming bubble. */
export function splitParagraphs(text: string): string[] {
  return text.split('\n\n').filter((p) => p.length > 0)
}
