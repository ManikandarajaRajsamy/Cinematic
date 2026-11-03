import { nowIST } from "@/api/mockServer";

// Delivery windows offered for one-off parcels, inside the shop's hours (6:30 am – 8:30 pm).
export const DELIVERY_SLOTS = ["7 – 10 am", "11 am – 2 pm", "4 – 7 pm"];

/** The next `n` days in IST as YYYY-MM-DD, starting today. */
export function upcomingDates(n: number) {
  const [y, m, d] = nowIST().date.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

export const dayLabel = (iso: string, i?: number) =>
  i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
