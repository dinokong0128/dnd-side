import { test, expect } from '@playwright/test'

test.describe('Sign up via invite link', () => {
  test('happy path: valid invite code shows signup form and submits', async ({
    page,
  }) => {
    // Mock Supabase invite lookup
    await page.route('**/rest/v1/invites*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ game_id: 'game-123' }),
      })
    })

    // Mock Supabase auth signup
    await page.route('**/auth/v1/signup', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'test@example.com',
        }),
      })
    })

    await page.goto('/auth/signup?code=valid-code')

    await expect(page.getByTestId('email-input')).toBeVisible()
    await expect(page.getByTestId('password-input')).toBeVisible()

    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('success-message')).toBeVisible()
  })

  test('no invite code shows invite-required message', async ({ page }) => {
    await page.route('**/rest/v1/invites*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.goto('/auth/signup')

    await expect(page.getByTestId('invite-required-message')).toBeVisible()
    await expect(page.getByTestId('email-input')).not.toBeVisible()
  })

  test('invalid code shows invite-required message', async ({ page }) => {
    await page.route('**/rest/v1/invites*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.goto('/auth/signup?code=bad')

    await expect(page.getByTestId('invite-required-message')).toBeVisible()
  })
})
