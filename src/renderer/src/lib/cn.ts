export type ClassValue = string | false | null | undefined

/** Minimal class-name joiner — no dependency needed for this. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
