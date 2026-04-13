import { test, expect } from '@playwright/test'

const GAME_ID = 'test-game-edit-123'
const USER_ID = 'user-1'
const PLAYER_MSG_ID = 'msg-player-last'
const DM_MSG_ID = 'msg-dm-after'

function mockAuth(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  return Promise.all([
    page.route('**/auth/v1/user', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: USER_ID, email: 'test@example.com' }),
      })
    ),
    page.route('**/auth/v1/token?grant_type=refresh_token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: USER_ID, email: 'test@example.com' },
        }),
      })
    ),
  ])
}

function mockGameData(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  return Promise.all([
    page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: GAME_ID,
              name: 'The Edit Test Campaign',
              dm_persona: 'A wise DM',
              status: 'active',
              created_by: USER_ID,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: null,
            },
          ]),
        })
      }
    }),
    page.route('**/supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'player-1',
              game_id: GAME_ID,
              profile_id: USER_ID,
              character_name: 'Kael Dawnstrider',
              character_class: 'Ranger',
              race: 'Half-Elf',
              level: 5,
              hp_current: 42,
              hp_max: 46,
            },
          ]),
        })
      }
    }),
    // Initial messages: one DM message + one player message (player is last)
    page.route('**/supabase.co/rest/v1/game_messages**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: DM_MSG_ID,
              game_id: GAME_ID,
              profile_id: null,
              role: 'dm',
              content: 'The dungeon stretches before you, cold and foreboding.',
              created_at: '2026-01-01T00:00:01Z',
            },
            {
              id: PLAYER_MSG_ID,
              game_id: GAME_ID,
              profile_id: USER_ID,
              role: 'player',
              content: 'I search the room for traps.',
              created_at: '2026-01-01T00:00:02Z',
            },
          ]),
        })
      }
    }),
  ])
}

test.describe('DIN-61 — Edit and delete last player message', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
    await mockGameData(page)
  })

  test('hovering the last player message reveals edit and delete controls', async ({
    page,
  }) => {
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Edit Test Campaign')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText('I search the room for traps.')).toBeVisible({
      timeout: 5000,
    })

    // Controls should not be visible before hover
    await expect(page.getByTestId('edit-message-btn')).not.toBeVisible()
    await expect(page.getByTestId('delete-message-btn')).not.toBeVisible()

    // Hover over the player message
    await page.getByText('I search the room for traps.').hover()

    // Edit and delete buttons should appear
    await expect(page.getByTestId('edit-message-btn')).toBeVisible({
      timeout: 3000,
    })
    await expect(page.getByTestId('delete-message-btn')).toBeVisible({
      timeout: 3000,
    })
  })

  test('edit flow: clicking edit shows inline textarea, Save & Resend calls PATCH', async ({
    page,
  }) => {
    let patchBody: Record<string, unknown> | null = null

    await page.route(
      `**/api/games/${GAME_ID}/messages/${PLAYER_MSG_ID}`,
      (route) => {
        if (route.request().method() === 'PATCH') {
          patchBody = route.request().postDataJSON()
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ok' }),
          })
        }
      }
    )

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('I search the room for traps.')).toBeVisible({
      timeout: 5000,
    })

    // Hover to reveal controls
    await page.getByText('I search the room for traps.').hover()
    await expect(page.getByTestId('edit-message-btn')).toBeVisible({
      timeout: 3000,
    })

    // Click edit
    await page.getByTestId('edit-message-btn').click()

    // Inline edit textarea should appear with existing content
    const editTextarea = page.getByTestId('edit-textarea')
    await expect(editTextarea).toBeVisible()
    await expect(editTextarea).toHaveValue('I search the room for traps.')

    // Clear and type new content
    await editTextarea.fill('I carefully inspect the lock mechanism.')

    // Save & Resend
    await page.getByTestId('save-edit-btn').click()

    // PATCH should have been called with new content
    expect(patchBody).toMatchObject({
      content: 'I carefully inspect the lock mechanism.',
    })

    // Edit mode should be dismissed
    await expect(editTextarea).not.toBeVisible({ timeout: 3000 })
  })

  test('edit flow: clicking Cancel restores original content without saving', async ({
    page,
  }) => {
    let patchCalled = false

    await page.route(
      `**/api/games/${GAME_ID}/messages/${PLAYER_MSG_ID}`,
      (route) => {
        if (route.request().method() === 'PATCH') {
          patchCalled = true
          route.fulfill({ status: 200, body: '{}' })
        }
      }
    )

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('I search the room for traps.')).toBeVisible({
      timeout: 5000,
    })

    await page.getByText('I search the room for traps.').hover()
    await page.getByTestId('edit-message-btn').click()

    const editTextarea = page.getByTestId('edit-textarea')
    await editTextarea.fill('This change should be discarded.')

    // Cancel
    await page.getByTestId('cancel-edit-btn').click()

    // PATCH should NOT have been called
    expect(patchCalled).toBe(false)

    // Edit textarea should be gone
    await expect(editTextarea).not.toBeVisible()

    // Original content should still show
    await expect(
      page.getByText('I search the room for traps.')
    ).toBeVisible()
  })

  test('delete flow: clicking delete calls DELETE endpoint', async ({
    page,
  }) => {
    let deleteCalled = false

    await page.route(
      `**/api/games/${GAME_ID}/messages/${PLAYER_MSG_ID}`,
      (route) => {
        if (route.request().method() === 'DELETE') {
          deleteCalled = true
          route.fulfill({ status: 204 })
        }
      }
    )

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('I search the room for traps.')).toBeVisible({
      timeout: 5000,
    })

    // Hover and delete
    await page.getByText('I search the room for traps.').hover()
    await expect(page.getByTestId('delete-message-btn')).toBeVisible({
      timeout: 3000,
    })
    await page.getByTestId('delete-message-btn').click()

    expect(deleteCalled).toBe(true)
  })

  test('DM messages do not show edit/delete controls on hover', async ({
    page,
  }) => {
    await page.goto(`/games/${GAME_ID}`)
    await expect(
      page.getByText('The dungeon stretches before you, cold and foreboding.')
    ).toBeVisible({ timeout: 5000 })

    // Hover over the DM message
    await page
      .getByText('The dungeon stretches before you, cold and foreboding.')
      .hover()

    // Controls should never appear for DM messages
    await expect(page.getByTestId('edit-message-btn')).not.toBeVisible()
    await expect(page.getByTestId('delete-message-btn')).not.toBeVisible()
  })
})
