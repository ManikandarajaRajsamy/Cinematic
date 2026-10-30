import { nowIST } from "./mockServer";
import type { Branch, BranchHoliday } from "./types";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const opensOn = (b: Pick<Branch, "open_days">, weekday: number) => b.open_days === "DAILY" || b.open_days.includes(weekday);

export function daysText(b: Pick<Branch, "open_days">) {
  if (b.open_days === "DAILY" || b.open_days.length === 7) return "Every day";
  return "Every " + [...b.open_days].sort().map((d) => DAY_NAMES[d]).join(", ");
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export function timeText(t: string) {
  const m = toMin(t), h = Math.floor(m / 60) % 24, mm = String(m % 60).padStart(2, "0");
  return `${h % 12 || 12}:${mm} ${h < 12 ? "am" : "pm"}`;
}
export const hoursText = (b: Pick<Branch, "open_time" | "close_time">) =>
  b.open_time && b.close_time ? `${timeText(b.open_time)} – ${timeText(b.close_time)}` : "";

export function isOpenToday(b: Branch, holidays: BranchHoliday[] = []) {
  const now = nowIST();
  return opensOn(b, now.weekday) && !holidays.some((h) => h.date === now.date);
}

export type Status = { kind: "open" | "later" | "closed"; text: string } | null;
/** Live status in IST. Null when the hours are not filled in: then only the days are shown. */
export function branchStatus(b: Branch, holidays: BranchHoliday[] = []): Status {
  if (!b.open_time || !b.close_time) return null;
  const now = nowIST();
  const today = isOpenToday(b, holidays);
  const open = toMin(b.open_time), close = toMin(b.close_time);
  if (today && now.minutes >= open && now.minutes < close) return { kind: "open", text: "Open now" };
  if (today && now.minutes < open) return { kind: "later", text: `Opens today at ${timeText(b.open_time)}` };
  // next opening day after today
  for (let i = 1; i <= 7; i++) {
    const wd = (now.weekday + i) % 7;
    if (opensOn(b, wd)) return { kind: "closed", text: i === 1 ? `Opens tomorrow at ${timeText(b.open_time)}` : `Opens ${DAY_NAMES[wd]}` };
  }
  return { kind: "closed", text: "Closed" };
}

export function directionsUrl(b: Pick<Branch, "google_maps_url" | "latitude" | "longitude">) {
  if (b.google_maps_url) return b.google_maps_url;
  if (b.latitude != null && b.longitude != null) return `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
  return "";
}

/** Reads "lat,lng" out of a pasted Google Maps link (…/@9.91,78.11,17z or ?q=9.91,78.11 or !3d9.91!4d78.11). */
export function latLngFromMapsLink(link: string): { lat: number; lng: number } | null {
  const pats = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/];
  for (const p of pats) {
    const m = link.match(p);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);
