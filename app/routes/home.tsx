import type { ShouldRevalidateFunctionArgs } from 'react-router'
import type { Route } from './+types/home'
import { fetchSlots } from '../lanes'
import { Button } from '~/components/ui/button'
import { ThemeToggle } from '~/components/theme-toggle'

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Langford Lanes availability' },
		{
			name: 'description',
			content: "Today's open bowling start times at Langford Lanes.",
		},
	]
}

export async function loader() {
	const date = new Date()
	const slots = await fetchSlots(date)
	const dateLabel = date.toLocaleDateString('en-CA', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	})
	return { dateLabel, slots }
}

// Don't re-fetch Meriq just because the theme cookie changed.
export function shouldRevalidate({
	formAction,
	defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
	if (formAction === '/set-theme') return false
	return defaultShouldRevalidate
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { dateLabel, slots } = loaderData
	return (
		<main className="mx-auto max-w-2xl p-4">
			<div className="flex items-center justify-between">
				<h1>Langford Lanes — {dateLabel}</h1>
				<ThemeToggle />
			</div>
			<Button render={<a href="https://secure.meriq.com/langford-lanes/" />}>
				Book
			</Button>
			{slots.length === 0 ? (
				<p>No available start times.</p>
			) : (
				<ul>
					{slots.map((slot) => (
						<li key={slot.value}>{slot.label}</li>
					))}
				</ul>
			)}
		</main>
	)
}
