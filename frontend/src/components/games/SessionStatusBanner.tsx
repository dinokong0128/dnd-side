'use client'

interface SessionStatusBannerProps {
  gameStatus: string
  isHost: boolean
  onResume?: () => void
  onEnd?: () => void
}

export function SessionStatusBanner({
  gameStatus,
  isHost,
  onResume,
  onEnd,
}: SessionStatusBannerProps) {
  if (gameStatus === 'paused') {
    return (
      <div
        className="flex-shrink-0 border-t border-b"
        style={{
          borderColor: 'rgba(212, 168, 67, 0.2)',
          background: 'rgba(212, 168, 67, 0.08)',
          padding: '1rem 1.5rem',
        }}
      >
        <div className="mx-auto max-w-3xl">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <h3
                className="font-bold"
                style={{
                  fontFamily: "'Cinzel', serif",
                  color: 'var(--dnd-amber)',
                }}
              >
                ⏸ Session paused
              </h3>
              <p
                className="text-sm"
                style={{
                  fontFamily: "'Lora', serif",
                  color: 'rgba(212, 168, 67, 0.7)',
                  marginTop: '0.25rem',
                }}
              >
                Waiting for host to resume
              </p>
            </div>

            {isHost && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={onResume}
                  disabled
                  className="rounded-sm px-4 py-2 font-semibold uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(180deg, #3a9d6e, #2d6a4f)',
                    border: '1px solid #2d6a4f',
                    color: 'var(--dnd-parchment)',
                    fontFamily: "'Cinzel', serif",
                  }}
                  title="Resume functionality coming in next release"
                >
                  ▶ Resume
                </button>
                <button
                  onClick={onEnd}
                  className="dnd-btn-secondary"
                  style={{
                    color: 'var(--dnd-crimson-bright)',
                    borderColor: 'rgba(139, 34, 50, 0.4)',
                  }}
                >
                  ⏹ End
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (gameStatus === 'ended') {
    return (
      <div
        className="flex-shrink-0 border-t border-b"
        style={{
          borderColor: 'rgba(74, 69, 64, 0.3)',
          background: 'rgba(74, 69, 64, 0.15)',
          padding: '1rem 1.5rem',
        }}
      >
        <div className="mx-auto max-w-3xl">
          <div>
            <h3
              className="font-bold"
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#7a756e',
              }}
            >
              ⏹ This adventure has concluded
            </h3>
            <p
              className="text-sm italic"
              style={{
                fontFamily: "'Lora', serif",
                color: '#7a756e',
                marginTop: '0.25rem',
              }}
            >
              The tale is told. Thank you for playing.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
