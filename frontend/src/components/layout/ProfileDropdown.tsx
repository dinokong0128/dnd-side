'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

interface ProfileDropdownProps {
  initials: string
}

export function ProfileDropdown({ initials }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!containerRef.current) return

      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onEscape)

    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.assign('/')
    } finally {
      setSigningOut(false)
      setOpen(false)
    }
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold"
        style={{
          borderColor: 'var(--dnd-gold-dim)',
          background: 'var(--dnd-charcoal)',
          color: 'var(--dnd-parchment)',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        {initials}
      </button>

      {open && (
        <div
          className="dnd-card absolute right-0 top-11 z-20 min-w-40 overflow-hidden"
          role="menu"
          aria-label="Profile menu"
        >
          <Link
            href="/account"
            className="block px-4 py-2 text-sm"
            style={{ color: 'var(--dnd-parchment)' }}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            My Profile
          </Link>
          <div
            className="mx-2"
            style={{ borderTop: '1px solid var(--dnd-brown)' }}
            aria-hidden="true"
          />
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-sm"
            style={{ color: 'var(--dnd-parchment)' }}
            onClick={handleSignOut}
            disabled={signingOut}
            role="menuitem"
          >
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      )}
    </div>
  )
}
