// Event order terms, as provided by the shop. Only the per-litre rate has a fixed amount; transport,
// live-counter service charges and the advance are confirmed on call, so no figures are shown for them.

export const EVENT_PHONE = "8825687662";
export const EVENT_RATE_PER_LITRE = 15000; // paise: Rs.150 per litre

export type ServiceOption = "PICKUP" | "DELIVERY" | "LIVE_COUNTER";

export const SERVICE_OPTIONS: { id: ServiceOption; title: string; ta: string; text: string; extras: string[] }[] = [
  { id: "PICKUP", title: "Pickup", ta: "கடையில் பெற்றுக்கொள்ளுதல்", text: "Collect the order from our shop.", extras: [] },
  { id: "DELIVERY", title: "Delivery", ta: "டெலிவரி", text: "We deliver to your venue.", extras: ["Transportation charges, based on distance"] },
  { id: "LIVE_COUNTER", title: "Live Counter", ta: "நேரடி கவுண்டர்", text: "Our staff serve hot Paruthippaal at your venue.", extras: ["Service charges", "Transportation charges"] },
];

export const EVENT_TYPES = ["Wedding", "Temple function", "Festival", "Office / corporate", "Birthday", "Other"];

export const EVENT_TERMS: { title: string; text: string }[] = [
  { title: "Rate", text: "Paruthippaal Rs.150 per litre." },
  { title: "Service options", text: "Please choose one when booking; the final price depends on the option. Pickup: collect the order from our shop, no extra charges. Delivery: we deliver to your venue, transportation charges apply based on distance. Live Counter: our staff serve hot Paruthippaal at your venue, service charges and transportation charges apply." },
  { title: "Advance", text: "An advance is to be paid at the time of booking to confirm the order." },
  { title: "Balance", text: "The balance amount will be collected on the event date at the time of delivery or pickup." },
  { title: "Payment mode", text: "Cash / UPI." },
  { title: "Freshly prepared", text: "Freshly prepared and ready on the event date at the agreed time." },
  { title: "Confirmation call", text: "We will contact you a day before the event to confirm the time and details." },
  { title: "Changes", text: "For any changes or queries, please call us." },
];
