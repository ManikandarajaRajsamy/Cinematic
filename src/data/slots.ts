// Kept free of imports: the API server and the screens both use it.
// Daily plan delivery windows, inside the shop's hours (6:30 am – 8:30 pm). Regular parcels have no slot.
export const DELIVERY_SLOTS = ["7 – 10 am", "11 am – 2 pm", "4 – 7 pm"];

/** Regular (home delivery) orders are delivered between 10 am and 8 pm IST; later orders go out the next day. */
export const REGULAR_HOURS = { from: 10, to: 20, label: "10 am – 8 pm" };
/** The day a regular order placed now is delivered (YYYY-MM-DD, IST): today until 8 pm, otherwise tomorrow. */
export function regularDeliveryDate(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  if (ist.getUTCHours() >= REGULAR_HOURS.to) ist.setUTCDate(ist.getUTCDate() + 1);
  return ist.toISOString().slice(0, 10);
}

/** The hour (IST, 24 h) a window starts: "11 am – 2 pm" → 11, "4 – 7 pm" → 16. */
export function slotStartHour(slot: string) {
  const m = slot.match(/^(\d{1,2})(?::\d{2})?\s*(am|pm)?/i);
  if (!m) return 7;
  const h = Number(m[1]);
  const mer = (m[2] ?? slot.match(/(am|pm)\s*$/i)?.[1] ?? "am").toLowerCase();
  return mer === "pm" && h < 12 ? h + 12 : h;
}
