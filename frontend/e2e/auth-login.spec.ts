import { test, expect } from '@playwright/test'

test.describe('Log in as returning user', () => {
  test('happy path: fill credentials and redirect to dashboard', async ({
    page,
  }) => {
    // Mock Supabase auth to return no user initially (not logged in)
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'not authenticated' }),
      })
    })

    // Mock successful login
    await page.route('**/auth/v1/token?grant_type=password', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: 'user-1', email: 'test@example.com' },
        }),
      })
    })

    await page.goto('/auth/login')

    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('submit-button').click()

    await page.waitForURL('**/dashboard**')
  })

  test('invalid credentials show error', async ({ page }) => {
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'not authenticated' }),
      })
    })

    await page.route('**/auth/v1/token?grant_type=password', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      })
    })

    await page.goto('/auth/login')

    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('wrongpassword')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('form-error')).toBeVisible()
  })

  test('already logged in redirects to dashboard', async ({ page }) => {
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'test@example.com',
        }),
      })
    })

    await page.goto('/auth/login')

    await page.waitForURL('**/dashboard**')
  })
})
