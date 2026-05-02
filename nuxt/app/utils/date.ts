import { parseDate, type DateValue } from '@internationalized/date'

export function isoToCalendarDate(s: string | null | undefined): DateValue | null {
  if (!s) return null
  try {
    return parseDate(s)
  } catch {
    return null
  }
}

export function calendarDateToIso(d: DateValue | null | undefined): string | null {
  return d ? d.toString() : null
}
