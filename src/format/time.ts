import type { Duration } from "../model/types";

// "45m", "1h", "1h 30m"
export function minutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

// Duration label without the exact/estimate marker: "8m", "8–10m", "1h–1h 30m".
export function durationValue(d: Duration): string {
  if (d.max === undefined || d.max === d.min) return minutes(d.min);
  if (d.max < 60) return `${d.min}–${d.max}m`;
  return `${minutes(d.min)}–${minutes(d.max)}`;
}

export function isExact(d: Duration): boolean {
  return d.basis === "exact";
}

// SPEC §6.4: estimates get "~"; exact durations are rendered with a stopwatch instead.
export function durationText(d: Duration): string {
  return isExact(d) ? durationValue(d) : `~${durationValue(d)}`;
}

function spoken(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (r || !h) parts.push(`${r} minute${r === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function durationAria(d: Duration): string {
  let value = spoken(d.min);
  if (d.max !== undefined && d.max !== d.min) {
    value = d.max < 60 ? `${d.min} to ${d.max} minutes` : `${spoken(d.min)} to ${spoken(d.max)}`;
  }
  return `${isExact(d) ? "exactly" : "about"} ${value}`;
}

// Elapsed time from the start of cooking: "0:04", "1:05".
export function timecode(m: number): string {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

// Eyebrow: "~47 MIN", "~1 HR 10 MIN".
export function totalLabel(m: number): string {
  if (m < 60) return `~${m} MIN`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `~${h} HR` : `~${h} HR ${r} MIN`;
}

// Scheduling uses the midpoint of a range, rounded up (SPEC §5.1).
export function plannedMinutes(d: Duration): number {
  return d.max === undefined ? d.min : Math.ceil((d.min + d.max) / 2);
}
