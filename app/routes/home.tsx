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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '~/components/ui/table'
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
				<div className="flex items-center gap-2">
					<img src="/bowling-ball.png" alt="" className="size-9" />
					<h1 className="text-3xl font-bold hidden sm:block">
						Langford Lanes Availability
					</h1>
					<h1 className="text-3xl font-bold sm:hidden">LL Availability</h1>
				</div>
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
				<Table className="text-base">
					<TableHeader>
						<TableRow>
							<TableHead>Time</TableHead>
							<TableHead className="text-right">Standard</TableHead>
							<TableHead className="text-right">VIP</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{/* key per date forces a fresh boundary so the skeleton shows on
						    each navigation — without it RR's transition keeps old rows */}
						<Suspense key={dateValue} fallback={<SlotsSkeletonRows />}>
							<Await
								resolve={loaderData.slots}
								errorElement={
									<TableRow>
										<TableCell colSpan={3}>
											Couldn't load times right now. Try again.
										</TableCell>
									</TableRow>
								}
							>
								{(resolved) =>
									resolved.length === 0 ? (
										<TableRow>
											<TableCell colSpan={3}>
												No available start times.
											</TableCell>
										</TableRow>
									) : (
										resolved.map((slot) => (
											<TableRow key={slot.value}>
												<TableCell className="font-medium">
													{slot.time}
												</TableCell>
												<TableCell className="text-right">
													{slot.standard}
												</TableCell>
												<TableCell className="text-right">{slot.vip}</TableCell>
											</TableRow>
										))
									)
								}
							</Await>
						</Suspense>
					</TableBody>
				</Table>
			)}

			<Button
				render={<a href="https://secure.meriq.com/langford-lanes/" />}
				size="xl"
				className="fixed right-6 bottom-6 bg-clip-border bg-[linear-gradient(to_bottom_left,rgba(255,255,255,0.3),transparent_25%)] shadow-[0_0_18px_0_rgba(225,44,90,0.85),0_0_48px_10px_rgba(225,44,90,0.55),inset_0_1px_0_rgba(255,255,255,0.7)]"
			>
				<HugeiconsIcon icon={BowlingIcon} className="size-6" />
				Book
			</Button>
		</main>
	)
}

function SlotsSkeletonRows() {
	return (
		<>
			{Array.from({ length: 12 }, (_, i) => (
				<TableRow key={i}>
					<TableCell>
						<Skeleton className="h-5 w-16" />
					</TableCell>
					<TableCell>
						<Skeleton className="ml-auto h-5 w-8" />
					</TableCell>
					<TableCell>
						<Skeleton className="ml-auto h-5 w-8" />
					</TableCell>
				</TableRow>
			))}
		</>
	)
}
