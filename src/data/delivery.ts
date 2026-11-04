import { nowIST } from "@/api/mockServer";

export { DELIVERY_SLOTS, slotStartHour } from "./slots";

/** The next `n` days in IST as YYYY-MM-DD, starting today. */
export function upcomingDates(n: number) {
  const [y, m, d] = nowIST().date.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

export const dayLabel = (iso: string, i?: number) =>
  i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
