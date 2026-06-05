import { data } from 'react-router'

import type { Route } from './+types/set-theme'
import { themeCookie } from '~/theme.server'
import type { Theme } from '~/theme'

// Resource route: no UI, just receives the toggle's POST and sets the cookie
// via a Set-Cookie response header.
export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	const theme: Theme = form.get('theme') === 'light' ? 'light' : 'dark'
	return data(null, {
		headers: { 'Set-Cookie': await themeCookie.serialize(theme) },
	})
}
