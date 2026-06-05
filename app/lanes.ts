// Langford Lanes availability via Meriq's booking system.
//
// Meriq encodes the booking date as `usedate` = number of days since
// 2007-01-01 (day 0). Times in the dropdown are minutes from midnight
// (e.g. 645 = 10:45am).

const EPOCH = Date.UTC(2007, 0, 1) // Jan 1 2007 = usedate 0
const DAY_MS = 86_400_000

export type Slot = {
	value: number // minutes from midnight
	label: string // e.g. "10:45am (4 standard | 6 vip lanes)"
}

export function toUsedate(date: Date) {
	// Use the date's local Y/M/D as a UTC midnight so DST never shifts the count.
	const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
	return Math.round((utc - EPOCH) / DAY_MS)
}

export async function fetchSlots(date: Date): Promise<Slot[]> {
	const usedate = toUsedate(date)
	const url =
		`https://secure.meriq.com/langford-lanes/currentstatus.asp` +
		`?selectedpath=1&usedate=${usedate}&usestart=0&uselength=0` +
		`&usepart=1&uselanes=0&cache=${Date.now()}`

	const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
	if (!res.ok) {
		throw new Error(`Meriq request failed: ${res.status} ${res.statusText}`)
	}
	const html = await res.text()

	// Grab the start-time <select> and pull out its <option>s.
	const select = html.match(/<select[^>]*name="usestart"[\s\S]*?<\/select>/i)
	if (!select) {
		throw new Error(
			"Couldn't find the start-time dropdown. Page layout may have changed.",
		)
	}

	const slots: Slot[] = []
	const optionRe = /<option value="(\d+)">([\s\S]*?)<\/option>/gi
	let m: RegExpExecArray | null
	while ((m = optionRe.exec(select[0])) !== null) {
		const value = Number(m[1])
		if (value === 0) continue // the "Choose" placeholder
		slots.push({ value, label: m[2].replace(/\s+/g, ' ').trim() })
	}
	return slots
}
