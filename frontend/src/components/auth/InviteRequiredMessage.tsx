'use client'

export function InviteRequiredMessage() {
  return (
    <div data-testid="invite-required-message" className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-2xl font-bold">Invite required</h1>
      <p className="text-gray-600">
        You need a valid invite link to sign up. Ask your Dungeon Master for
        one.
      </p>
    </div>
  )
}
