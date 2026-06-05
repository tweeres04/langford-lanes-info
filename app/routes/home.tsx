import { Suspense } from 'react'
import {
	Await,
	Form,
	useSubmit,
	type ShouldRevalidateFunctionArgs,
} from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
	BowlingIcon,
} from '@hugeicons/core-free-icons'

import type { Route } from './+types/home'
import { fetchSlots } from '../lanes'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
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

// The date travels in a readable `?date=YYYY-MM-DD` query string; we translate
// it to Meriq's day-integer in fetchSlots. Missing/invalid falls back to today.
function parseDateParam(value: string | null): Date {
	const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (match) {
		const date = new Date(
			Number(match[1]),
			Number(match[2]) - 1,
			Number(match[3]),
		)
		if (!Number.isNaN(date.getTime())) return date
	}
	return new Date()
}

function toDateInputValue(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date)
	next.setDate(next.getDate() + days)
	return next
}

export async function loader({ request }: Route.LoaderArgs) {
	const date = parseDateParam(new URL(request.url).searchParams.get('date'))
	const dateValue = toDateInputValue(date)
	const todayValue = toDateInputValue(new Date())
	const common = {
		dateLabel: date.toLocaleDateString('en-CA', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
		}),
		dateValue,
		prevValue: toDateInputValue(addDays(date, -1)),
		nextValue: toDateInputValue(addDays(date, 1)),
		todayValue,
	}
	// YYYY-MM-DD strings compare lexicographically, so this is a safe date check.
	// Past dates: skip the Meriq fetch entirely.
	if (dateValue < todayValue) {
		return { ...common, isPast: true as const }
	}
	return {
		...common,
		isPast: false as const,
		// Returned unawaited so the shell renders instantly and the list streams
		// in — flipping days shows a skeleton right away instead of blocking.
		slots: fetchSlots(date),
	}
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
	const { dateLabel, dateValue, prevValue, nextValue, todayValue } = loaderData
	const submit = useSubmit()
	// At today, stepping back would land on a past date — so block it.
	const prevDisabled = prevValue < todayValue

	return (
		<main className="mx-auto max-w-2xl p-4 pb-28 text-lg">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-3xl font-bold hidden sm:block">
					Langford Lanes Availability
				</h1>
				<h1 className="text-3xl font-bold sm:hidden">LL Availability</h1>
				<ThemeToggle />
			</div>

			<div className="mb-4 flex items-center gap-2">
				<Form method="get">
					<Button
						type="submit"
						name="date"
						value={prevValue}
						variant="outline"
						size="icon-lg"
						aria-label="Previous day"
						disabled={prevDisabled}
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} />
					</Button>
				</Form>

				<Form
					method="get"
					className="flex-1"
					onChange={(event) => submit(event.currentTarget)}
				>
					{/* key forces a remount so the picker shows the new date after nav */}
					<Input
						key={dateValue}
						type="date"
						name="date"
						defaultValue={dateValue}
						min={todayValue}
						aria-label="Pick a date"
						className="h-11 text-base"
					/>
				</Form>

				<Form method="get">
					<Button
						type="submit"
						name="date"
						value={nextValue}
						variant="outline"
						size="icon-lg"
						aria-label="Next day"
					>
						<HugeiconsIcon icon={ArrowRight01Icon} />
					</Button>
				</Form>
			</div>

			<h2 className="mb-4 text-xl font-semibold">{dateLabel}</h2>

			{loaderData.isPast ? (
				<p>This date is in the past.</p>
			) : (
				/* key per date forces a fresh boundary so the skeleton shows on each
				   navigation — without it, RR's transition keeps the old list visible */
				<Suspense key={dateValue} fallback={<SlotsSkeleton />}>
					<Await
						resolve={loaderData.slots}
						errorElement={<p>Couldn't load times right now. Try again.</p>}
					>
						{(resolved) =>
							resolved.length === 0 ? (
								<p>No available start times.</p>
							) : (
								<ul className="space-y-2">
									{resolved.map((slot) => (
										<li key={slot.value}>{slot.label}</li>
									))}
								</ul>
							)
						}
					</Await>
				</Suspense>
			)}

			<Button
				render={<a href="https://secure.meriq.com/langford-lanes/" />}
				size="xl"
				className="fixed right-6 bottom-6 shadow-lg"
			>
				<HugeiconsIcon icon={BowlingIcon} className="size-6" />
				Book
			</Button>
		</main>
	)
}

function SlotsSkeleton() {
	return (
		<ul className="space-y-2">
			{Array.from({ length: 12 }, (_, i) => (
				<li key={i}>
					<Skeleton className="h-7 w-64 max-w-full" />
				</li>
			))}
		</ul>
	)
}
