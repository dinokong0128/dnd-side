export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(score: number): string {
  const m = getModifier(score)
  return m >= 0 ? `+${m}` : `${m}`
}
