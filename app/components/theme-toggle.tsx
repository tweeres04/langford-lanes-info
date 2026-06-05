import { useFetcher, useRouteLoaderData } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun03Icon, Moon02Icon } from '@hugeicons/core-free-icons'

import { Button } from '~/components/ui/button'
import type { Theme } from '~/theme'
import type { loader } from '~/root'

export function ThemeToggle() {
	const data = useRouteLoaderData<typeof loader>('root')
	const fetcher = useFetcher()

	// Reflect the in-flight submission immediately, otherwise the cookie the
	// server resolved on this request.
	const pending = fetcher.formData?.get('theme') as Theme | undefined
	const theme = pending ?? data?.theme ?? 'dark'
	const next: Theme = theme === 'dark' ? 'light' : 'dark'

	return (
		<fetcher.Form method="post" action="/set-theme">
			<input type="hidden" name="theme" value={next} />
			<Button
				type="submit"
				variant="outline"
				size="sm"
				aria-label="Toggle theme"
				className="max-sm:w-8 max-sm:px-0"
				// Flip the class right away so colors switch with no round-trip;
				// the POST just persists the choice in the cookie.
				onClick={() =>
					document.documentElement.classList.toggle('dark', next === 'dark')
				}
			>
				{theme === 'dark' ? (
					<HugeiconsIcon icon={Moon02Icon} />
				) : (
					<HugeiconsIcon icon={Sun03Icon} />
				)}
				<span className="hidden sm:inline">
					{theme === 'dark' ? 'Dark' : 'Light'}
				</span>
			</Button>
		</fetcher.Form>
	)
}
