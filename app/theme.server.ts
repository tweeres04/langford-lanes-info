import { createCookie } from 'react-router'

import type { Theme } from './theme'

// One year, in seconds. The cookie is server-only (httpOnly) since nothing on
// the client needs to read it — the server resolves the theme on every request.
export const themeCookie = createCookie('theme', {
	path: '/',
	sameSite: 'lax',
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 365,
})

// Default to dark when no choice has been saved yet.
export async function getTheme(request: Request): Promise<Theme> {
	const value = await themeCookie.parse(request.headers.get('Cookie'))
	return value === 'light' ? 'light' : 'dark'
}
