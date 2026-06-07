import { Suspense, useEffect, useRef, useState } from 'react'
import {
	Await,
	Form,
	useSearchParams,
	useRevalidator,
	useSubmit,
	type ShouldRevalidateFunctionArgs,
} from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
	BowlingIcon,
	FilterIcon,
	Saturn01Icon,
	Share03Icon,
} from '@hugeicons/core-free-icons'

import type { Route } from './+types/home'
import { fetchSlots, type Slot } from '../lanes'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '~/components/ui/sheet'
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

const SITE_URL = 'https://langfordlanes.tweeres.com'
const SITE_NAME = 'Langford Lanes availability'
const TITLE = 'Langford Lanes availability — open lanes & cosmic bowling'
const DESCRIPTION =
	"A faster way to see what's open at Langford Lanes — live start times, standard & VIP lane counts, and cosmic bowling sessions."
const OG_IMAGE = `${SITE_URL}/og-image.png`

// Shared by the visible FAQ and the FAQPage JSON-LD so they never drift.
const FAQ = [
	{
		q: 'What is this?',
		a: "A faster, friendlier way to see what's open at Langford Lanes. It has live start times, standard & VIP lane counts, and cosmic bowling sessions at a glance.",
	},
	{
		q: 'Is this the official Langford Lanes site?',
		a: "No. This is an independent tool built by a local. When you tap Book, you're sent to Langford Lanes' official booking system to reserve.",
	},
	{
		q: 'How current is the availability?',
		a: 'It mirrors what the booking system shows right now, so open times and lane counts are live. Times that have already passed today are hidden automatically.',
	},
	{
		q: 'What is cosmic bowling?',
		a: 'Glow-in-the-dark bowling with the lights down and the music up. Start times tagged "Cosmic" here are cosmic bowling sessions.',
	},
]

export function meta({}: Route.MetaArgs) {
	return [
		{ title: TITLE },
		{ name: 'description', content: DESCRIPTION },
		{ tagName: 'link', rel: 'canonical', href: `${SITE_URL}/` },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:site_name', content: SITE_NAME },
		{ property: 'og:title', content: TITLE },
		{ property: 'og:description', content: DESCRIPTION },
		{ property: 'og:url', content: `${SITE_URL}/` },
		{ property: 'og:image', content: OG_IMAGE },
		{ property: 'og:image:width', content: '1024' },
		{ property: 'og:image:height', content: '579' },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: TITLE },
		{ name: 'twitter:description', content: DESCRIPTION },
		{ name: 'twitter:image', content: OG_IMAGE },
		{
			'script:ld+json': {
				'@context': 'https://schema.org',
				'@type': 'FAQPage',
				mainEntity: FAQ.map((item) => ({
					'@type': 'Question',
					name: item.q,
					acceptedAnswer: { '@type': 'Answer', text: item.a },
				})),
			},
		},
		{
			'script:ld+json': {
				'@context': 'https://schema.org',
				'@type': 'BowlingAlley',
				name: 'Langford Lanes',
				description: DESCRIPTION,
				url: 'https://citycentrepark.ca/langford-lanes/',
				telephone: '+1-250-391-1738',
				image: OG_IMAGE,
				address: {
					'@type': 'PostalAddress',
					streetAddress: '1097 Langford Pkwy',
					addressLocality: 'Victoria',
					addressRegion: 'BC',
					postalCode: 'V9B 0A5',
					addressCountry: 'CA',
				},
				openingHoursSpecification: [
					{
						'@type': 'OpeningHoursSpecification',
						dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
						opens: '10:00',
						closes: '23:00',
					},
					{
						'@type': 'OpeningHoursSpecification',
						dayOfWeek: 'Friday',
						opens: '10:00',
						closes: '00:00',
					},
					{
						'@type': 'OpeningHoursSpecification',
						dayOfWeek: 'Saturday',
						opens: '09:00',
						closes: '00:00',
					},
					{
						'@type': 'OpeningHoursSpecification',
						dayOfWeek: 'Sunday',
						opens: '09:00',
						closes: '23:00',
					},
				],
			},
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

// Langford Lanes closing time (minutes from midnight). Fri/Sat run to 12am.
function closeMinutes(date: Date): number {
	const day = date.getDay() // 0 Sun … 6 Sat
	return day === 5 || day === 6 ? 24 * 60 : 23 * 60
}

// Cosmic bowling windows by day of week (start–end minutes from midnight).
// Fri–Sun it's everything after 6pm; weekdays have the bottomless sessions.
const COSMIC_WINDOWS: Record<number, [number, number][]> = {
	0: [[1080, 1380]], // Sun: 6:00pm – close
	1: [
		[1020, 1185], // Mon: 5:00 – 7:45pm
		[1260, 1380], // Mon: 9:00 – 11:00pm
	],
	2: [], // Tue: none
	3: [
		[1020, 1185], // Wed: 5:00 – 7:45pm
		[1200, 1380], // Wed: 8:00 – 11:00pm
	],
	4: [[1260, 1380]], // Thu: 9:00 – 11:00pm
	5: [[1080, 1440]], // Fri: 6:00pm – close
	6: [[1080, 1440]], // Sat: 6:00pm – close
}

function isCosmic(slot: Slot, dayOfWeek: number): boolean {
	return (COSMIC_WINDOWS[dayOfWeek] ?? []).some(
		([start, end]) => slot.value >= start && slot.value <= end,
	)
}

const MAX_LENGTH_MIN = 180 // Meriq caps a booking at 3 hours
const LANE_OPTIONS = [1, 2, 3] // Meriq lets you book up to 3 lanes
const LENGTH_OPTIONS = [
	{ value: '30', label: '30 min' },
	{ value: '45', label: '45 min' },
	{ value: '60', label: '1 hr' },
	{ value: '90', label: '1.5 hrs' },
	{ value: '120', label: '2 hrs' },
	{ value: '150', label: '2.5 hrs' },
	{ value: '180', label: '3 hrs' },
]

type LaneType = 'any' | 'standard' | 'vip'
type CosmicFilter = 'any' | 'cosmic' | 'regular'

// Filter values come from the query string; clamp them to known-good values.
function parseLaneType(value: string | null): LaneType {
	return value === 'standard' || value === 'vip' ? value : 'any'
}
function parseLanes(value: string | null): number {
	const n = Number(value)
	return LANE_OPTIONS.includes(n) ? n : 0
}
function parseLength(value: string | null): number {
	const n = Number(value)
	return LENGTH_OPTIONS.some((o) => Number(o.value) === n) ? n : 0
}
function parseCosmic(value: string | null): CosmicFilter {
	return value === 'cosmic' || value === 'regular' ? value : 'any'
}

function lanesForType(slot: Slot, type: LaneType): number {
	if (type === 'standard') return slot.standard
	if (type === 'vip') return slot.vip
	return slot.standard + slot.vip
}

// The longest booking a start time can fit before closing (capped at 3h).
function maxBookableMinutes(slot: Slot, close: number): number {
	return Math.min(MAX_LENGTH_MIN, close - slot.value)
}

function slotFits(
	slot: Slot,
	type: LaneType,
	lanes: number,
	minLength: number,
	close: number,
	cosmic: CosmicFilter,
	dayOfWeek: number,
): boolean {
	if (lanes > 0 && lanesForType(slot, type) < lanes) return false
	if (minLength > 0 && maxBookableMinutes(slot, close) < minLength) return false
	if (cosmic === 'cosmic' && !isCosmic(slot, dayOfWeek)) return false
	if (cosmic === 'regular' && isCosmic(slot, dayOfWeek)) return false
	return true
}

export async function loader({ request }: Route.LoaderArgs) {
	const date = parseDateParam(new URL(request.url).searchParams.get('date'))
	const dateValue = toDateInputValue(date)
	const now = new Date()
	const todayValue = toDateInputValue(now)
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
		closeMinutes: closeMinutes(date),
		dayOfWeek: date.getDay(),
	}
	// YYYY-MM-DD strings compare lexicographically, so this is a safe date check.
	// Past dates: skip the Meriq fetch entirely.
	if (dateValue < todayValue) {
		return { ...common, isPast: true as const }
	}
	const isToday = dateValue === todayValue
	const nowMinutes = now.getHours() * 60 + now.getMinutes()
	return {
		...common,
		isPast: false as const,
		// Returned unawaited so the shell renders instantly and the list streams
		// in — flipping days shows a skeleton right away instead of blocking.
		// On today, drop already-passed start times here so they never get sent.
		slots: fetchSlots(date).then((slots) =>
			isToday ? slots.filter((slot) => slot.value >= nowMinutes) : slots,
		),
	}
}

// Only re-fetch Meriq when the date actually changes — not for the theme
// cookie or filter (?type/?lanes/?length) tweaks, which are applied client-side.
export function shouldRevalidate({
	currentUrl,
	nextUrl,
	formAction,
	defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
	if (formAction === '/set-theme') return false
	// Manual revalidation (returning to the app) reuses the exact same URL —
	// that's a deliberate refresh, so let it through.
	if (currentUrl.href === nextUrl.href) return defaultShouldRevalidate
	if (
		currentUrl.pathname === nextUrl.pathname &&
		currentUrl.searchParams.get('date') === nextUrl.searchParams.get('date')
	) {
		return false
	}
	return defaultShouldRevalidate
}

// Refresh the data when the user comes back to the app (tab/PWA becomes
// visible or the window refocuses) and it's been a while. useRevalidator
// re-runs the loaders in place — the table just updates when fresh slots
// arrive, no reload and no skeleton flash.
const REVALIDATE_AFTER_MS = 60_000

function useRevalidateOnReturn() {
	const revalidator = useRevalidator()
	const lastLoadedAt = useRef(Date.now())

	useEffect(() => {
		function revalidateIfStale() {
			if (
				document.visibilityState === 'visible' &&
				revalidator.state === 'idle' &&
				Date.now() - lastLoadedAt.current > REVALIDATE_AFTER_MS
			) {
				lastLoadedAt.current = Date.now()
				revalidator.revalidate()
			}
		}
		document.addEventListener('visibilitychange', revalidateIfStale)
		window.addEventListener('focus', revalidateIfStale)
		return () => {
			document.removeEventListener('visibilitychange', revalidateIfStale)
			window.removeEventListener('focus', revalidateIfStale)
		}
	}, [revalidator])
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { dateLabel, dateValue, prevValue, nextValue, todayValue } = loaderData
	const submit = useSubmit()
	useRevalidateOnReturn()
	// At today, stepping back would land on a past date — so block it.
	const prevDisabled = prevValue < todayValue

	// Filters live in the query string (?type, ?lanes, ?length) so they're
	// server-rendered and shareable, and changing them never re-fetches Meriq.
	const [searchParams, setSearchParams] = useSearchParams()
	const laneType = parseLaneType(searchParams.get('type'))
	const lanes = parseLanes(searchParams.get('lanes'))
	const minLength = parseLength(searchParams.get('length'))
	const cosmic = parseCosmic(searchParams.get('cosmic'))
	const filtersActive =
		laneType !== 'any' || lanes > 0 || minLength > 0 || cosmic !== 'any'

	function setFilter(key: string, value: string | null, emptyValue: string) {
		setSearchParams(
			(prev) => {
				if (!value || value === emptyValue) prev.delete(key)
				else prev.set(key, value)
				return prev
			},
			{ replace: true, preventScrollReset: true },
		)
	}

	return (
		<>
			<DiscoLights />
			<main className="container p-4 pb-28 text-lg">
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<img src="/bowling-ball.png" alt="" className="size-9" />
						<h1 className="hidden neon-title text-3xl font-bold sm:block">
							Langford Lanes Availability
						</h1>
						<h1 className="text-3xl font-bold sm:hidden neon-title">
							LL Availability
						</h1>
					</div>
					<ThemeToggle />
				</div>

				<div className="mb-4 flex items-center gap-2">
					<Form method="get">
						<FilterParams
							laneType={laneType}
							lanes={lanes}
							minLength={minLength}
							cosmic={cosmic}
						/>
						<Button
							type="submit"
							name="date"
							value={prevValue}
							variant="outline"
							size="lg"
							aria-label="Previous day"
							disabled={prevDisabled}
							className="max-sm:w-10 max-sm:px-0"
						>
							<HugeiconsIcon icon={ArrowLeft01Icon} />
							<span className="hidden sm:inline">Previous</span>
						</Button>
					</Form>

					<Form
						method="get"
						className="flex-1"
						onChange={(event) => submit(event.currentTarget)}
					>
						<FilterParams
							laneType={laneType}
							lanes={lanes}
							minLength={minLength}
							cosmic={cosmic}
						/>
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
						<FilterParams
							laneType={laneType}
							lanes={lanes}
							minLength={minLength}
							cosmic={cosmic}
						/>
						<Button
							type="submit"
							name="date"
							value={nextValue}
							variant="outline"
							size="lg"
							aria-label="Next day"
							className="max-sm:w-10 max-sm:px-0"
						>
							<span className="hidden sm:inline">Next</span>
							<HugeiconsIcon icon={ArrowRight01Icon} />
						</Button>
					</Form>
				</div>

				<div className="mb-4 flex items-center justify-between gap-2">
					<h2 className="text-xl font-semibold">{dateLabel}</h2>
					<div className="flex items-center gap-2">
						<ShareButton />
						<Sheet>
							<SheetTrigger
								render={
									<Button variant="outline">
										<HugeiconsIcon icon={FilterIcon} />
										Filters
										{filtersActive && (
											<span className="size-2 rounded-full bg-primary" />
										)}
									</Button>
								}
							/>
							<SheetContent side="bottom">
								<div className="container space-y-4">
									<SheetHeader>
										<SheetTitle>Filters</SheetTitle>
										<SheetDescription>
											Times that don't fit get faded out.
										</SheetDescription>
									</SheetHeader>
									<div className="grid gap-4 px-4">
										<div className="grid gap-2">
											<Label>Cosmic bowling</Label>
											<Select
												value={cosmic}
												onValueChange={(value) =>
													setFilter('cosmic', value, 'any')
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue>
														{(value) =>
															value === 'cosmic'
																? 'Cosmic'
																: value === 'regular'
																	? 'Not cosmic'
																	: 'Either'
														}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="any">Either</SelectItem>
													<SelectItem value="cosmic">Cosmic</SelectItem>
													<SelectItem value="regular">Not cosmic</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label>Lane type</Label>
											<Select
												value={laneType}
												onValueChange={(value) =>
													setFilter('type', value, 'any')
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue>
														{(value) =>
															value === 'standard'
																? 'Standard'
																: value === 'vip'
																	? 'VIP'
																	: 'Any'
														}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="any">Any</SelectItem>
													<SelectItem value="standard">Standard</SelectItem>
													<SelectItem value="vip">VIP</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label>Lanes needed</Label>
											<Select
												value={String(lanes)}
												onValueChange={(value) =>
													setFilter('lanes', value, '0')
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue>
														{(value) => (value === '0' ? 'Any' : value)}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="0">Any</SelectItem>
													{LANE_OPTIONS.map((n) => (
														<SelectItem key={n} value={String(n)}>
															{n}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label>Minimum length</Label>
											<Select
												value={String(minLength)}
												onValueChange={(value) =>
													setFilter('length', value, '0')
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue>
														{(value) =>
															value === '0'
																? 'Any'
																: (LENGTH_OPTIONS.find((o) => o.value === value)
																		?.label ?? value)
														}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="0">Any</SelectItem>
													{LENGTH_OPTIONS.map((o) => (
														<SelectItem key={o.value} value={o.value}>
															{o.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
									<SheetFooter>
										<SheetClose render={<Button>Done</Button>} />
									</SheetFooter>
								</div>
							</SheetContent>
						</Sheet>
					</div>
				</div>

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
												<TableRow
													key={slot.value}
													className={
														slotFits(
															slot,
															laneType,
															lanes,
															minLength,
															loaderData.closeMinutes,
															cosmic,
															loaderData.dayOfWeek,
														)
															? 'transition-opacity'
															: 'opacity-40 transition-opacity'
													}
												>
													<TableCell className="font-medium">
														<span className="flex items-center gap-2">
															{slot.time}
															{isCosmic(slot, loaderData.dayOfWeek) && (
																<Badge>
																	<HugeiconsIcon icon={Saturn01Icon} />
																	Cosmic
																</Badge>
															)}
														</span>
													</TableCell>
													<TableCell className="text-right">
														{slot.standard}
													</TableCell>
													<TableCell className="text-right">
														{slot.vip}
													</TableCell>
												</TableRow>
											))
										)
									}
								</Await>
							</Suspense>
						</TableBody>
					</Table>
				)}

				<div className="pointer-events-none fixed inset-x-0 bottom-6">
					<div className="container flex justify-end px-4">
						<Button
							render={<a href="https://secure.meriq.com/langford-lanes/" />}
							size="xl"
							className="pointer-events-auto bg-clip-border bg-[linear-gradient(to_bottom_left,rgba(255,255,255,0.3),transparent_25%)] shadow-[0_0_18px_0_rgba(225,44,90,0.85),0_0_48px_10px_rgba(225,44,90,0.55),inset_0_1px_0_rgba(255,255,255,0.7)]"
						>
							<HugeiconsIcon icon={BowlingIcon} className="size-6" />
							Book
						</Button>
					</div>
				</div>
				<section className="mt-12">
					<h2 className="mb-4 text-xl font-semibold">FAQ</h2>
					<dl className="space-y-4">
						{FAQ.map((item) => (
							<div key={item.q}>
								<dt className="font-medium">{item.q}</dt>
								<dd className="text-muted-foreground">{item.a}</dd>
							</div>
						))}
					</dl>
				</section>

				<footer className="mt-10 text-center text-sm text-muted-foreground">
					By{' '}
					<a
						href="https://tweeres.com"
						className="font-medium text-foreground underline underline-offset-4"
					>
						Tyler Weeres
					</a>
				</footer>
			</main>
		</>
	)
}

// Share the current URL — date + filters travel in the query string, so the
// link reopens the exact view. Native share sheet when available, else copy.
function ShareButton() {
	const [copied, setCopied] = useState(false)

	async function share() {
		const url = window.location.href
		if (navigator.share) {
			try {
				await navigator.share({ title: 'Langford Lanes Availability', url })
			} catch {
				// user dismissed the share sheet — nothing to do
			}
			return
		}
		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// clipboard blocked — nothing to do
		}
	}

	return (
		<Button
			type="button"
			variant="outline"
			onClick={share}
			aria-label="Share"
			className="max-sm:w-9 max-sm:px-0"
		>
			<HugeiconsIcon icon={Share03Icon} />
			<span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
		</Button>
	)
}

// Hidden inputs that carry the active filters through the date GET forms, so
// flipping days keeps your filters instead of resetting them.
function FilterParams({
	laneType,
	lanes,
	minLength,
	cosmic,
}: {
	laneType: LaneType
	lanes: number
	minLength: number
	cosmic: CosmicFilter
}) {
	return (
		<>
			{laneType !== 'any' && (
				<input type="hidden" name="type" value={laneType} />
			)}
			{lanes > 0 && <input type="hidden" name="lanes" value={lanes} />}
			{minLength > 0 && <input type="hidden" name="length" value={minLength} />}
			{cosmic !== 'any' && <input type="hidden" name="cosmic" value={cosmic} />}
		</>
	)
}

// Slow-drifting colored glows behind everything — distant disco lights.
function DiscoLights() {
	return (
		<div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			<div className="absolute -left-24 top-10 size-72 animate-[disco-drift-1_9s_ease-in-out_infinite] rounded-full bg-[#E12C5A] opacity-30 blur-3xl" />
			<div className="absolute right-0 top-1/3 size-80 animate-[disco-drift-2_11s_ease-in-out_infinite] rounded-full bg-[#8B2FC9] opacity-25 blur-3xl" />
			<div className="absolute bottom-0 left-1/3 size-72 animate-[disco-drift-3_13s_ease-in-out_infinite] rounded-full bg-[#2FB6C9] opacity-20 blur-3xl" />
		</div>
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
