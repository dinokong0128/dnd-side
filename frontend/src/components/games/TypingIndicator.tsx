'use client'

export function TypingIndicator() {
  return (
    <>
      <style>{`
        @keyframes typingDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .typing-dot {
          animation: typingDot 0.6s ease-in-out infinite;
          display: inline-block;
          width: 0.35rem;
          height: 0.35rem;
          border-radius: 50%;
          margin: 0 0.15rem;
          background: #6fcf97;
        }
        .typing-dot:nth-child(2) {
          animation-delay: 0.1s;
        }
        .typing-dot:nth-child(3) {
          animation-delay: 0.2s;
        }
      `}</style>
      <div className="mb-4 flex items-center gap-2">
        <p
          className="font-serif italic text-sm"
          style={{ color: 'var(--dnd-parchment-dim)' }}
        >
          The Dungeon Master is writing
        </p>
        <div>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </>
  )
}
